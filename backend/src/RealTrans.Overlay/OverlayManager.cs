using System;
using System.Collections.Concurrent;
using System.Windows;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.DPI;
using RealTrans.Overlay.Modes;

namespace RealTrans.Overlay
{
    /// <summary>
    /// Creates, positions, updates, and destroys overlay windows.
    /// Listens for overlay:update messages from WebMessageBus.
    /// Applies DPI conversion before positioning WPF windows.
    /// </summary>
    public class OverlayManager : IDisposable
    {
        private readonly WebMessageBus _bus;
        private readonly DpiHelper _dpi;
        private readonly ILogger<OverlayManager> _logger;
        private readonly ConcurrentDictionary<string, OverlayWindowBase> _windows = new();
        private readonly ConcurrentDictionary<string, uint> _lastApplied = new();

        public OverlayManager(WebMessageBus bus, DpiHelper dpi, ILogger<OverlayManager> logger)
        {
            _bus = bus;
            _dpi = dpi;
            _logger = logger;
            _bus.OutboundReady += OnOutboundMessage;
        }

        private void OnOutboundMessage(object? sender, OutboundMessage msg)
        {
            // NOTE: We DELIBERATELY do NOT close overlay windows in response to
            // TranslationClearedMessage. That message is published by
            // SubtitleHoldTimer 600 ms after the LAST TranslationResultMessage,
            // which can happen while the source subtitle is still visible on
            // screen (OCR dedup suppresses the next result for identical text).
            // Closing here causes the overlay to flicker open/closed every
            // ~1–2 s on static text — the very bug round-9 fixes.
            //
            // Overlay windows are scoped to the SESSION lifetime: created on
            // first OverlayUpdateMessage, replaced on render-mode switch, and
            // swept by Dispose() when the OverlayManager itself is torn down.
            // The auto-clear of the in-window React feed for inline mode is
            // handled in JS and is unaffected by this change (OverlayManager
            // never owned the feed pane).
            if (msg is OverlayUpdateMessage update)
                Application.Current?.Dispatcher.Invoke(() => ApplyUpdate(update));
        }

        private void ApplyUpdate(OverlayUpdateMessage update)
        {
            // Inline render mode shows results in the app's in-window feed pane
            // (Original/Translated split), not as a screen overlay — skip window
            // creation entirely. Any leftover overlay window for this region from
            // a previous render mode is closed to avoid stale rectangles on screen.
            if (string.Equals(update.RenderMode, "inline", StringComparison.OrdinalIgnoreCase))
            {
                if (_windows.TryRemove(update.RegionId, out var leftover))
                    leftover.Close();
                _lastApplied[update.RegionId] = update.SequenceId;
                return;
            }

            // Sequence guard: drop late-arriving results
            var lastSeq = _lastApplied.GetOrAdd(update.RegionId, 0u);
            if (update.SequenceId < lastSeq)
            {
                _logger.LogDebug("Dropping stale overlay update seq={Seq} for {Region}", update.SequenceId, update.RegionId);
                return;
            }
            _lastApplied[update.RegionId] = update.SequenceId;

            // Prefer the tight text box (over the original text) when the OCR
            // engine reported geometry; otherwise fall back to the whole region.
            var posRect = update.TextRect is { W: > 0, H: > 0 } tr ? tr : update.Rect;
            var wpfRect = _dpi.PixelsToWpf(new System.Drawing.Rectangle(
                posRect.X, posRect.Y, posRect.W, posRect.H));

            if (!_windows.TryGetValue(update.RegionId, out var window) ||
                window.GetType() != GetWindowTypeForMode(update.RenderMode))
            {
                // CRITICAL: remove the stale entry from the map BEFORE closing the
                // old window. If another OverlayUpdateMessage races us between the
                // Close() and the dictionary write below, it will TryGetValue the
                // disposed window and call UpdateTranslation on it — NRE on
                // _textBlock.Text. Removing first means a racing message reaches
                // the "create new" branch and does the right thing.
                if (window != null)
                {
                    _windows.TryRemove(update.RegionId, out _);
                    try { window.Close(); }
                    catch (Exception ex) { _logger.LogDebug(ex, "Closing stale overlay window for {Region}", update.RegionId); }
                }
                window = CreateWindow(update.RenderMode);
                _windows[update.RegionId] = window;
                window.Show();
            }

            window.PositionAt(wpfRect.X, wpfRect.Y, wpfRect.Width, wpfRect.Height);
            // Wrap the update in try/catch as a belt-and-braces guard. The window
            // we just stored CAN still be torn down by a Dispose() that runs in
            // between (e.g., session stop racing a final translation result).
            // The window itself also no-ops if its Dispatcher is shut down.
            try { window.UpdateTranslation(update.TranslatedText, update.RenderMode); }
            catch (Exception ex) { _logger.LogDebug(ex, "UpdateTranslation failed for {Region}", update.RegionId); }
        }

        private static OverlayWindowBase CreateWindow(string renderMode) => renderMode switch
        {
            "ghost" => new GhostOverlayWindow(),
            _ => new ReplaceOverlayWindow(),  // "replace" is the default
        };

        private static Type GetWindowTypeForMode(string renderMode) => renderMode switch
        {
            "ghost" => typeof(GhostOverlayWindow),
            _ => typeof(ReplaceOverlayWindow),
        };

        public void Dispose()
        {
            _bus.OutboundReady -= OnOutboundMessage;
            Application.Current?.Dispatcher.Invoke(() =>
            {
                foreach (var w in _windows.Values) w.Close();
                _windows.Clear();
            });
        }
    }
}

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
            if (msg is OverlayUpdateMessage update)
                Application.Current?.Dispatcher.Invoke(() => ApplyUpdate(update));
            else if (msg is TranslationClearedMessage cleared)
                Application.Current?.Dispatcher.Invoke(() => HideOverlay(cleared.RegionId));
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

            var wpfRect = _dpi.PixelsToWpf(new System.Drawing.Rectangle(
                update.Rect.X, update.Rect.Y, update.Rect.W, update.Rect.H));

            if (!_windows.TryGetValue(update.RegionId, out var window) ||
                window.GetType() != GetWindowTypeForMode(update.RenderMode))
            {
                window?.Close();
                window = CreateWindow(update.RenderMode);
                _windows[update.RegionId] = window;
                window.Show();
            }

            window.PositionAt(wpfRect.X, wpfRect.Y, wpfRect.Width, wpfRect.Height);
            window.UpdateTranslation(update.TranslatedText, update.RenderMode);
        }

        private void HideOverlay(string regionId)
        {
            if (_windows.TryRemove(regionId, out var window))
            {
                window.Close();
                _lastApplied.TryRemove(regionId, out _);
            }
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

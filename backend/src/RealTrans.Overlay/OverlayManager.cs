using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
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
    ///
    /// A region renders as a SET of windows — one per detected paragraph block when
    /// the OCR engine reports per-line geometry (Google-Translate style), or a single
    /// window over the union/region rect otherwise. The set grows/shrinks as the block
    /// count changes between frames.
    /// </summary>
    public class OverlayManager : IDisposable
    {
        private readonly WebMessageBus _bus;
        private readonly DpiHelper _dpi;
        private readonly ILogger<OverlayManager> _logger;
        // One list of windows per region (index i ↔ block i for the current frame).
        // All access happens on the WPF dispatcher (every handler marshals via
        // Dispatcher.Invoke), so the lists are effectively single-threaded.
        private readonly ConcurrentDictionary<string, List<OverlayWindowBase>> _windows = new();
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
            else if (msg is OverlayCloseMessage close)
                Application.Current?.Dispatcher.Invoke(() => CloseRegion(close.RegionId));
            else if (msg is OverlayVisibilityMessage vis)
                Application.Current?.Dispatcher.Invoke(() => SetRegionVisibility(vis.RegionId, vis.Visible));
        }

        // Hides/shows a region's overlay window(s) WITHOUT closing or forgetting them
        // (they stay in _windows). Published by the session while the user scrolls so
        // a stale translation doesn't float over moving content; the next settled
        // OverlayUpdateMessage re-shows them with fresh text. Visibility.Hidden (not
        // Collapsed) keeps the HWND alive so flipping back is cheap.
        private void SetRegionVisibility(string regionId, bool visible)
        {
            if (!_windows.TryGetValue(regionId, out var windows))
                return;
            var v = visible ? Visibility.Visible : Visibility.Hidden;
            foreach (var window in windows)
            {
                try { window.Visibility = v; }
                catch (Exception ex) { _logger.LogDebug(ex, "SetRegionVisibility failed for {Region}", regionId); }
            }
        }

        // Closes and forgets all overlay windows for a region when its session stops.
        // Without this, Ghost/Replace windows (click-through, so the user can't
        // dismiss them) lingered on screen after Stop/ESC.
        private void CloseRegion(string regionId)
        {
            if (_windows.TryRemove(regionId, out var windows))
                CloseAll(windows, regionId);
            _lastApplied.TryRemove(regionId, out _);
        }

        private void ApplyUpdate(OverlayUpdateMessage update)
        {
            // Inline render mode shows results in the app's in-window feed pane
            // (Original/Translated split), not as a screen overlay — skip window
            // creation entirely. Any leftover overlay windows for this region from
            // a previous render mode are closed to avoid stale rectangles on screen.
            if (string.Equals(update.RenderMode, "inline", StringComparison.OrdinalIgnoreCase))
            {
                if (_windows.TryRemove(update.RegionId, out var leftover))
                    CloseAll(leftover, update.RegionId);
                _lastApplied[update.RegionId] = update.SequenceId;
                return;
            }

            // Sequence guard: drop late-arriving results. All blocks of a frame share
            // one OverlayUpdateMessage (one SequenceId), so a late frame drops as a unit.
            var lastSeq = _lastApplied.GetOrAdd(update.RegionId, 0u);
            if (update.SequenceId < lastSeq)
            {
                _logger.LogDebug("Dropping stale overlay update seq={Seq} for {Region}", update.SequenceId, update.RegionId);
                return;
            }
            _lastApplied[update.RegionId] = update.SequenceId;

            // Build the render list: one (text, screen-pixel box) per paragraph block
            // when present; otherwise a single entry over the tight text box (preferred)
            // or the whole region rect (engines without geometry).
            var items = new List<(string Text, RectDto Rect)>();
            if (update.Blocks is { Count: > 0 } blocks)
            {
                foreach (var b in blocks)
                    if (b.Rect is { W: > 0, H: > 0 })
                        items.Add((b.Text, b.Rect));
            }
            if (items.Count == 0)
            {
                var posRect = update.TextRect is { W: > 0, H: > 0 } tr ? tr : update.Rect;
                items.Add((update.TranslatedText, posRect));
            }

            // Reconcile the region's window set to exactly items.Count windows of the
            // correct type, then position + update each.
            var windows = ReconcileWindows(update.RegionId, items.Count, update.RenderMode);
            for (int i = 0; i < items.Count; i++)
            {
                var window = windows[i];
                var r = items[i].Rect;
                var wpfRect = _dpi.PixelsToWpf(new System.Drawing.Rectangle(r.X, r.Y, r.W, r.H));
                window.PositionAt(wpfRect.X, wpfRect.Y, wpfRect.Width, wpfRect.Height);
                // Re-show if a motion-onset OverlayVisibilityMessage hid this window
                // while the user was scrolling: this settled result carries fresh text,
                // so the overlay reappears already up to date (no stale-text flash).
                if (window.Visibility != Visibility.Visible) window.Visibility = Visibility.Visible;
                // Belt-and-braces guard: the window CAN still be torn down by a Dispose()
                // racing a final result; the window itself also no-ops on a shut-down dispatcher.
                try { window.UpdateTranslation(items[i].Text, update.RenderMode); }
                catch (Exception ex) { _logger.LogDebug(ex, "UpdateTranslation failed for {Region}", update.RegionId); }
            }
        }

        // Ensures the region has exactly `count` shown windows of the type for
        // `renderMode`: closes surplus, replaces wrong-typed slots (render-mode switch),
        // and creates any missing. Returns the region's window list.
        private List<OverlayWindowBase> ReconcileWindows(string regionId, int count, string renderMode)
        {
            var desiredType = GetWindowTypeForMode(renderMode);
            var list = _windows.GetOrAdd(regionId, _ => new List<OverlayWindowBase>());

            // Close + drop surplus windows (this frame has fewer blocks than the last).
            // Remove from the list BEFORE Close() — Close can pump the dispatcher, so a
            // window must never be reachable via _windows once we've decided to kill it.
            for (int i = list.Count - 1; i >= count; i--)
            {
                var stale = list[i];
                list.RemoveAt(i);
                try { stale.Close(); }
                catch (Exception ex) { _logger.LogDebug(ex, "Closing surplus overlay window for {Region}", regionId); }
            }

            for (int i = 0; i < count; i++)
            {
                if (i < list.Count)
                {
                    if (list[i].GetType() != desiredType)
                    {
                        // Render-mode switch: swap the reference in BEFORE closing the old
                        // window, for the same reason as above.
                        var old = list[i];
                        list[i] = CreateAndShow(renderMode);
                        try { old.Close(); }
                        catch (Exception ex) { _logger.LogDebug(ex, "Closing stale overlay window for {Region}", regionId); }
                    }
                }
                else
                {
                    list.Add(CreateAndShow(renderMode));
                }
            }
            return list;
        }

        private static void CloseAll(List<OverlayWindowBase> windows, string regionId)
        {
            foreach (var w in windows)
            {
                try { w.Close(); } catch { /* best-effort teardown */ }
            }
            windows.Clear();
        }

        private static OverlayWindowBase CreateAndShow(string renderMode)
        {
            var window = CreateWindow(renderMode);
            window.Show();
            return window;
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
                foreach (var windows in _windows.Values)
                    CloseAll(windows, string.Empty);
                _windows.Clear();
            });
        }
    }
}

using System;
using RealTrans.Core.Stabilization;
using Translumo.Infrastructure;
using Translumo.Processing.Interfaces;

namespace RealTrans.Core.Bridge
{
    /// <summary>
    /// ITranslationResultSink implementation that routes results to WebMessageBus.
    /// Also publishes overlay:update so OverlayManager can position the overlay window.
    /// </summary>
    public class WebTranslationResultSink : ITranslationResultSink
    {
        private readonly WebMessageBus _bus;
        private readonly TranslationSequencer _sequencer;
        private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (RectDto Rect, string RenderMode)> _regionMeta = new();

        public WebTranslationResultSink(WebMessageBus bus, TranslationSequencer sequencer)
        {
            _bus = bus;
            _sequencer = sequencer;
        }

        /// <summary>Called by SessionManager when a region session starts.</summary>
        public void RegisterRegion(string regionId, RectDto rect, string renderMode)
        {
            _regionMeta[regionId] = (rect, renderMode);
        }

        public void UnregisterRegion(string regionId) => _regionMeta.TryRemove(regionId, out _);

        public void SendRegionResult(string regionId, string sourceText, string translatedText, TimeSpan elapsed,
            System.Drawing.Rectangle? textBounds)
        {
            // Drop results for an unregistered region (session stopped) so a late
            // in-flight translation can't resurrect a dismissed overlay.
            if (!_regionMeta.TryGetValue(regionId, out var meta))
                return;
            uint seq = _sequencer.Next();

            _bus.Publish(new TranslationResultMessage(
                regionId, sourceText, translatedText,
                (int)elapsed.TotalMilliseconds,
                meta.RenderMode));

            _bus.Publish(new OverlayUpdateMessage(
                regionId,
                meta.Rect,
                meta.RenderMode,
                translatedText,
                seq,
                ToScreenTextRect(meta.Rect, textBounds)));
        }

        /// <summary>
        /// Offsets a region-local OCR text box by the region's screen origin and
        /// clamps it to the region, yielding a screen-pixel rect for the overlay.
        /// Returns null when there's no usable geometry (overlay falls back to the
        /// full region rect). Pure — kept static for clarity/testability.
        /// </summary>
        internal static RectDto? ToScreenTextRect(RectDto region, System.Drawing.Rectangle? localBounds)
        {
            if (localBounds is not { Width: > 0, Height: > 0 } b) return null;
            if (region.W <= 0 || region.H <= 0) return null;

            // Clamp the local box to the region (defends against sub-pixel rounding
            // in the OCR-image → source mapping).
            int x = Math.Clamp(b.X, 0, region.W);
            int y = Math.Clamp(b.Y, 0, region.H);
            int w = Math.Min(b.Width, region.W - x);
            int h = Math.Min(b.Height, region.H - y);
            if (w <= 0 || h <= 0) return null;

            return new RectDto(region.X + x, region.Y + y, w, h);
        }

        // Legacy IChatTextMediator overloads. Translumo's TranslationProcessingService
        // calls these to surface lifecycle + error text — we route them to the JS feed
        // so the user sees actionable failures instead of a silent overlay.

        public void SendText(string text, bool successful)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            if (successful)
                _bus.Publish(new StatusMessage("info", text));
            else
                _bus.Publish(new ErrorMessage("pipeline", text));
        }

        public void SendText(string text, TextTypes textType)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            if (textType == TextTypes.Error)
                _bus.Publish(new ErrorMessage("pipeline", text));
            else
                _bus.Publish(new StatusMessage("info", text));
        }

        public void ClearTexts() { /* no-op: feed is owned by JS and clears on its own */ }
    }
}

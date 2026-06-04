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

        public void SendRegionResult(string regionId, string sourceText, string translatedText, TimeSpan elapsed)
        {
            uint seq = _sequencer.Next();
            if (!_regionMeta.TryGetValue(regionId, out var meta))
                meta = (new RectDto(0, 0, 0, 0), "replace");

            _bus.Publish(new TranslationResultMessage(
                regionId, sourceText, translatedText,
                (int)elapsed.TotalMilliseconds,
                meta.RenderMode));

            _bus.Publish(new OverlayUpdateMessage(
                regionId,
                meta.Rect,
                meta.RenderMode,
                translatedText,
                seq));
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

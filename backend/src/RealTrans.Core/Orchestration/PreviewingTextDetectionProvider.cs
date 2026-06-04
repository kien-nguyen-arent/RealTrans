using System;
using System.Diagnostics;
using System.Threading.Tasks;
using RealTrans.Core.Bridge;
using Translumo.Infrastructure.Language;
using Translumo.Infrastructure.MachineLearning;
using Translumo.OCR;
using Translumo.Processing.Configuration;
using Translumo.Processing.TextProcessing;

namespace RealTrans.Core.Orchestration
{
    /// <summary>
    /// Subclass of the legacy <see cref="TextDetectionProvider"/> that publishes the
    /// raw OCR text as an <see cref="OcrPreviewMessage"/> on every call — even when
    /// the validity score is below the translation threshold. The Inline render mode
    /// displays these in the Original half so the user can verify OCR is reading
    /// SOMETHING (whatever language) when the translation half is silent.
    ///
    /// Throttled to one publish per <see cref="ThrottleMs"/> (1 second) so we don't
    /// flood the IPC bus on the ~8 Hz OCR loop.
    ///
    /// Hooked into the pipeline by registering this class as the
    /// <see cref="TextDetectionProvider"/> implementation in DI — the legacy
    /// TranslationProcessingService injects the base type and gets this subclass.
    /// </summary>
    public class PreviewingTextDetectionProvider : TextDetectionProvider
    {
        private const int ThrottleMs = 1000;

        private readonly WebMessageBus _bus;
        private readonly Stopwatch _throttle = Stopwatch.StartNew();
        private long _lastEmitMs = -ThrottleMs; // allow the first preview immediately
        private string _lastText = string.Empty;
        private readonly object _gate = new();

        public PreviewingTextDetectionProvider(
            TextValidityPredictor textValidityPredictor,
            LanguageService languageService,
            TextProcessingConfiguration configuration,
            WebMessageBus bus)
            : base(textValidityPredictor, languageService, configuration)
        {
            _bus = bus;
        }

        public override TextDetectionResult GetText(IOCREngine ocrEngine, byte[] img)
        {
            var result = base.GetText(ocrEngine, img);
            TryPublishPreview(result?.Text);
            return result!;
        }

        public override Task<TextDetectionResult> GetTextAsync(IOCREngine ocrEngine, byte[] img)
        {
            // base.GetTextAsync wraps base.GetText in Task.Factory.StartNew. Virtual
            // dispatch on `this` resolves to OUR override, so we don't need to hook
            // again here — but only the primary OCR uses GetText synchronously; the
            // async path is used by the secondary engines whose preview we don't
            // currently surface to keep traffic predictable.
            return base.GetTextAsync(ocrEngine, img);
        }

        private void TryPublishPreview(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;

            lock (_gate)
            {
                long nowMs = _throttle.ElapsedMilliseconds;
                // Skip if it's been less than the throttle window AND the text hasn't
                // changed — but always publish a different text immediately (so the
                // user sees the OCR react to a new region without waiting 1s).
                if (text == _lastText && nowMs - _lastEmitMs < ThrottleMs)
                    return;
                if (text != _lastText)
                {
                    _lastText = text;
                }
                else if (nowMs - _lastEmitMs < ThrottleMs)
                {
                    return;
                }
                _lastEmitMs = nowMs;
            }

            // Region id: the singleton provider doesn't know which session called it.
            // In single-region usage (Inline mode's typical case) this is fine — the
            // JS displays the latest preview regardless. For multi-region the right
            // fix is to thread RegionId through TranslationProcessingService.GetText.
            _bus.Publish(new OcrPreviewMessage(string.Empty, text));
        }
    }
}

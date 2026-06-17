using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using Translumo.Infrastructure.Language;
using Translumo.Infrastructure.MachineLearning;
using Translumo.OCR;
using Translumo.Processing.Configuration;
using Translumo.Processing.TextProcessing;

namespace RealTrans.Core.Orchestration
{
    /// <summary>
    /// Subclass of the legacy <see cref="TextDetectionProvider"/> that exposes
    /// per-iteration OCR + capture telemetry to the UI for live debugging:
    ///
    /// 1. <see cref="OcrTickMessage"/> on EVERY <see cref="GetText"/> call
    ///    (throttled 2 Hz). Includes iteration counter, capture byte size,
    ///    OCR text excerpt + char count, validity score, engine type. Lets the
    ///    user prove the OCR loop is alive even when text is empty.
    ///
    /// 2. <see cref="CaptureThumbnailMessage"/> — base64-encoded 200 px-wide PNG
    ///    of the captured region. Emitted at ~0.5 Hz so the user can VISUALLY
    ///    confirm capture is targeting the right pixels.
    ///
    /// 3. Saves the most recent capture to
    ///    %LOCALAPPDATA%/RealTrans/debug-last-capture.png so the user can open
    ///    the full-resolution image externally to share / inspect.
    ///
    /// All publishes are best-effort: serialization/encoding failures are
    /// logged and swallowed — they must never break the OCR loop.
    /// </summary>
    public class PreviewingTextDetectionProvider : TextDetectionProvider
    {
        // Throttle windows. We want the tick row to feel live, so 2 Hz; the
        // thumbnail is more expensive (PNG encode + base64) so 0.5 Hz.
        private const int TickThrottleMs      = 500;
        private const int ThumbnailThrottleMs = 2000;
        private const int ThumbnailMaxWidth   = 200;

        private readonly WebMessageBus _bus;
        private readonly ILogger<PreviewingTextDetectionProvider>? _logger;
        private readonly Stopwatch _clock = Stopwatch.StartNew();
        private readonly string _debugCapturePath;

        private long _iteration;
        private long _lastTickMs = -TickThrottleMs;
        private long _lastThumbnailMs = -ThumbnailThrottleMs;

        public PreviewingTextDetectionProvider(
            TextValidityPredictor textValidityPredictor,
            LanguageService languageService,
            TextProcessingConfiguration configuration,
            WebMessageBus bus,
            ILogger<PreviewingTextDetectionProvider>? logger = null)
            : base(textValidityPredictor, languageService, configuration)
        {
            _bus = bus;
            _logger = logger;

            // Debug screenshot path. Lives in %LOCALAPPDATA% so it survives across
            // runs but is per-user and doesn't pollute the install directory.
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "RealTrans");
            try
            {
                Directory.CreateDirectory(dir);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to create debug capture dir {Dir}", dir);
            }
            _debugCapturePath = Path.Combine(dir, "debug-last-capture.png");
        }

        public override TextDetectionResult GetText(IOCREngine ocrEngine, byte[] img)
        {
            long iter = Interlocked.Increment(ref _iteration);
            var result = base.GetText(ocrEngine, img);

            try
            {
                EmitTick(ocrEngine, img, result, iter);
                MaybeEmitThumbnail(img);
            }
            catch (Exception ex)
            {
                // Diagnostic failures must NEVER break the OCR loop.
                _logger?.LogWarning(ex, "Diagnostic emit failed at iter {Iter}", iter);
            }

            return result!;
        }

        public override Task<TextDetectionResult> GetTextAsync(IOCREngine ocrEngine, byte[] img)
        {
            // base.GetTextAsync wraps base.GetText in Task.Factory.StartNew. Virtual
            // dispatch on `this` resolves to OUR override, so we still emit ticks
            // from async paths via the synchronous code path inside the Task.
            return base.GetTextAsync(ocrEngine, img);
        }

        // ── Tick ────────────────────────────────────────────────────────────────

        private void EmitTick(IOCREngine ocrEngine, byte[] img, TextDetectionResult? result, long iter)
        {
            long nowMs = _clock.ElapsedMilliseconds;
            // Always allow the first tick of a session through (lastTickMs starts
            // negative). After that, throttle to TickThrottleMs.
            if (nowMs - _lastTickMs < TickThrottleMs) return;
            _lastTickMs = nowMs;

            string text = result?.Text ?? string.Empty;
            int charCount = text.Length;
            // Truncate the excerpt — long text bodies bloat IPC unnecessarily.
            string excerpt = charCount > 120 ? text.Substring(0, 120) + "…" : text;
            double score = result?.ValidityScore ?? 0;
            string engineName = ocrEngine.GetType().Name;

            _bus.Publish(new OcrTickMessage(
                RegionId: string.Empty,
                Iteration: iter,
                CaptureBytes: img?.Length ?? 0,
                Text: excerpt,
                CharCount: charCount,
                ValidityScore: score,
                EngineName: engineName,
                LastCapturePath: _debugCapturePath));
        }

        // ── Thumbnail + disk save ───────────────────────────────────────────────

        private void MaybeEmitThumbnail(byte[] img)
        {
            if (img == null || img.Length == 0) return;
            long nowMs = _clock.ElapsedMilliseconds;
            if (nowMs - _lastThumbnailMs < ThumbnailThrottleMs) return;
            _lastThumbnailMs = nowMs;

            try
            {
                using var srcStream = new MemoryStream(img);
                using var src = new Bitmap(srcStream);

                int srcW = src.Width, srcH = src.Height;
                if (srcW <= 0 || srcH <= 0) return;

                int dstW = Math.Min(srcW, ThumbnailMaxWidth);
                int dstH = (int)Math.Round(srcH * ((double)dstW / srcW));
                if (dstH < 1) dstH = 1;

                using var thumb = new Bitmap(dstW, dstH);
                using (var g = Graphics.FromImage(thumb))
                {
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.DrawImage(src, 0, 0, dstW, dstH);
                }

                // Save the thumbnail-sized PNG to disk too (good enough for visual
                // verification; full-res capture is huge and not worth saving).
                try
                {
                    thumb.Save(_debugCapturePath, ImageFormat.Png);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to save debug capture to {Path}", _debugCapturePath);
                }

                using var pngStream = new MemoryStream();
                thumb.Save(pngStream, ImageFormat.Png);
                string base64 = Convert.ToBase64String(pngStream.ToArray());

                _bus.Publish(new CaptureThumbnailMessage(
                    RegionId: string.Empty,
                    Base64Png: base64,
                    Width: dstW,
                    Height: dstH));
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Thumbnail encode failed");
            }
        }
    }
}

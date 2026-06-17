using System.Collections.Generic;
using System.Linq;
using RealTrans.Core.Stabilization;
using Xunit;

namespace RealTrans.Core.Tests
{
    /// <summary>
    /// Simulates the processing loop's gate ordering (pixel gate -> OCR -> text-stability gate ->
    /// dedup) over a synthetic frame stream, to prove the two properties that matter:
    ///   1. Static subtitles are still translated (the settle window keeps the pixel gate from
    ///      starving the consecutive-frame stability quorum).
    ///   2. Once content has settled, the pixel gate suppresses further OCR (the CPU saving).
    /// </summary>
    public class PixelGatePipelineTests
    {
        private const int Required = 2; // consecutive identical OCR frames before translating

        // A frame is a fill of one byte value; the OCR map turns a value into recognized text.
        private const byte Blank = 0;
        private const byte Hello = 200;
        private const byte World = 100;

        private static readonly Dictionary<byte, string> Ocr = new()
        {
            [Blank] = "",       // no text -> ValidityScore 0 path
            [Hello] = "Hello",
            [World] = "World",
        };

        private static byte[] Frame(byte value)
        {
            var buffer = new byte[100];
            for (int i = 0; i < buffer.Length; i++) buffer[i] = value;
            return buffer;
        }

        private sealed class Result
        {
            public int OcrCount;
            public int Suppressed;
            public List<string> Translations = new();
        }

        /// <param name="useSettleWindow">
        /// When false, models a naive "skip whenever the frame looks unchanged" gate (settle window
        /// of effectively zero) to demonstrate the starvation bug the real gate avoids.
        /// </param>
        private static Result RunPipeline(IEnumerable<byte> frameValues, bool useSettleWindow)
        {
            var gate = new FrameGate(settleFrames: useSettleWindow ? Required : 1);
            var naiveDiffer = new FrameDiffer();
            var stab = new StabilizationEngine(Required);
            var result = new Result();
            string? lastTranslated = null;

            foreach (var value in frameValues)
            {
                var frame = Frame(value);

                bool process = useSettleWindow
                    ? gate.ShouldProcess(frame)
                    : !naiveDiffer.IsSimilarToPrevious(frame); // naive: only changed frames

                if (!process)
                {
                    result.Suppressed++;
                    continue;
                }

                result.OcrCount++;
                var text = Ocr[value];
                if (text.Length == 0) continue;          // ValidityScore 0 -> no stability check
                if (!stab.IsStable(text)) continue;        // text-level quorum gate
                if (text == lastTranslated) continue;      // dedup cache
                lastTranslated = text;
                result.Translations.Add(text);
            }

            return result;
        }

        [Fact]
        public void StaticSubtitles_AreStillTranslated()
        {
            // blank, then a long static "Hello", then a long static "World".
            var frames = new[] { Blank }
                .Concat(Enumerable.Repeat(Hello, 10))
                .Concat(Enumerable.Repeat(World, 10));

            var result = RunPipeline(frames, useSettleWindow: true);

            // Both lines translate exactly once despite their frames being identical for seconds.
            Assert.Equal(new[] { "Hello", "World" }, result.Translations);
        }

        [Fact]
        public void StaticSubtitles_SuppressMostOcr()
        {
            var frames = new[] { Blank }
                .Concat(Enumerable.Repeat(Hello, 10))
                .Concat(Enumerable.Repeat(World, 10))
                .ToArray();

            var result = RunPipeline(frames, useSettleWindow: true);

            // 21 frames in, but OCR only runs on the change + its settle window for each segment:
            // blank(1) + Hello(change + 2 settle = 3) + World(change + 2 settle = 3) = 7.
            Assert.Equal(7, result.OcrCount);
            Assert.Equal(frames.Length - 7, result.Suppressed);
            Assert.True(result.OcrCount < frames.Length); // CPU is genuinely saved
        }

        [Fact]
        public void NaiveGate_WithoutSettleWindow_StarvesStabilizationAndNeverTranslates()
        {
            // Same stream, but a naive "skip unchanged frames" gate (no settle window).
            var frames = new[] { Blank }
                .Concat(Enumerable.Repeat(Hello, 10))
                .Concat(Enumerable.Repeat(World, 10));

            var result = RunPipeline(frames, useSettleWindow: false);

            // Each line's first frame is OCR'd once, then every identical frame is skipped, so the
            // consecutive-frame quorum is never reached: nothing is ever translated. This is exactly
            // the regression the settle window exists to prevent.
            Assert.Empty(result.Translations);
        }

        [Fact]
        public void BlankIdleScreen_ConvergesToZeroOcr()
        {
            var frames = Enumerable.Repeat(Blank, 10).ToArray();

            var result = RunPipeline(frames, useSettleWindow: true);

            // change(1) + settle window(2) = 3 OCRs, then the static blank screen is fully suppressed.
            Assert.Equal(3, result.OcrCount);
            Assert.Empty(result.Translations);
        }

        [Fact]
        public void ContinuouslyChangingFrames_AreAllProcessed()
        {
            // Alternating clearly-distinct fills => every frame is a change => nothing suppressed.
            var frames = Enumerable.Range(0, 8).Select(i => i % 2 == 0 ? Hello : World).ToArray();

            var result = RunPipeline(frames, useSettleWindow: true);

            Assert.Equal(frames.Length, result.OcrCount);
            Assert.Equal(0, result.Suppressed);
        }
    }
}

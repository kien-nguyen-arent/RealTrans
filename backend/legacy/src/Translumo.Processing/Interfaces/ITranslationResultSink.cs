using System;
using System.Collections.Generic;

namespace Translumo.Processing.Interfaces
{
    public interface ITranslationResultSink : IChatTextMediator
    {
        /// <param name="textBounds">
        /// Pixel bounding box of the recognized source text within the captured
        /// region (region-local coordinates), or null when the OCR engine didn't
        /// report geometry. Lets the sink position the overlay tightly over the
        /// original text instead of across the whole region.
        /// </param>
        /// <param name="blocks">
        /// Per-paragraph translated text + region-local box, in reading order, when the
        /// frame was split into paragraphs. Null/empty ⇒ single-blob result; the sink
        /// then positions one overlay at <paramref name="textBounds"/>.
        /// </param>
        void SendRegionResult(string regionId, string sourceText, string translatedText, TimeSpan elapsed,
            System.Drawing.Rectangle? textBounds,
            IReadOnlyList<(string Text, System.Drawing.Rectangle Rect)> blocks = null);
    }
}

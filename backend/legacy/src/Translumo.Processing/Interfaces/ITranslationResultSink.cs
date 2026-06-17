using System;

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
        void SendRegionResult(string regionId, string sourceText, string translatedText, TimeSpan elapsed,
            System.Drawing.Rectangle? textBounds);
    }
}

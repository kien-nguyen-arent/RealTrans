using System.Collections.Generic;
using System.Drawing;

namespace Translumo.OCR
{
    /// <summary>
    /// One recognized text line with its pixel bounding box, in the source image's
    /// coordinate space. <see cref="Text"/> is exactly the corresponding entry in the
    /// engine's <see cref="IOCREngine.GetTextLines"/> result (already space-stripped
    /// for languages that use a space remover), so a block's text equals the
    /// concatenation of its lines' text.
    /// </summary>
    public readonly record struct OcrLine(string Text, Rectangle Bounds);

    /// <summary>
    /// Optional capability for an <see cref="IOCREngine"/> that can report per-line
    /// text + geometry from the most recent <see cref="IOCREngine.GetTextLines"/>
    /// call (in reading order), not just the single union box of
    /// <see cref="IOcrTextBoundsProvider"/>. Used to group lines into paragraphs and
    /// render one overlay per paragraph, Google-Translate style.
    ///
    /// Engines that don't implement this report no lines, so callers fall back to the
    /// single-blob translation/overlay path — it degrades gracefully.
    /// </summary>
    public interface IOcrLineProvider
    {
        /// <summary>
        /// Per-line text + source-pixel bounds from the last <c>GetTextLines</c> call,
        /// in reading order. Empty when no text was found or the engine doesn't track
        /// geometry. Only valid immediately after the corresponding call on the same
        /// engine instance — callers should snapshot it right away.
        /// </summary>
        IReadOnlyList<OcrLine> LastLines { get; }
    }
}

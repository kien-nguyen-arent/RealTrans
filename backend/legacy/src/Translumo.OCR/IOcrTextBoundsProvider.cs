using System.Drawing;

namespace Translumo.OCR
{
    /// <summary>
    /// Optional capability for an <see cref="IOCREngine"/> that can report the
    /// pixel bounding box (in the source image's coordinate space) covering all
    /// text recognized in the most recent <see cref="IOCREngine.GetTextLines"/>
    /// call. Used to position translation overlays tightly over the original text
    /// — matching its location and size, Google-Translate style — instead of
    /// spreading the translation across the whole captured region.
    ///
    /// Engines that don't implement this leave the overlay at the full region
    /// rect (the previous behavior), so it degrades gracefully.
    /// </summary>
    public interface IOcrTextBoundsProvider
    {
        /// <summary>
        /// Bounding box of all text from the last <c>GetTextLines</c> call, in the
        /// source image's pixel coordinates, or <c>null</c> when no text was found.
        /// Only valid immediately after the corresponding call on the same engine
        /// instance — callers should snapshot it right away.
        /// </summary>
        Rectangle? LastTextBounds { get; }
    }
}

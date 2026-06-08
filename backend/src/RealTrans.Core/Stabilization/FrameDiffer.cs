using System;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Compares consecutive captures by raw byte difference ratio.
    /// Skips the OCR/translate pipeline when the frame hasn't changed meaningfully.
    /// </summary>
    public class FrameDiffer
    {
        // 2.5% change required to consider frames "different" and run OCR. Lower
        // than the previous 5% so smaller changes (a few words updated on the
        // page, a cursor flickering, partial scroll) still trigger re-OCR.
        // Going below ~1% risks chasing compositor jitter — the OCR thread would
        // spin on noise even when nothing meaningful changed.
        private const double SimilarityThreshold = 0.025;

        private byte[]? _previous;

        public bool IsSimilarToPrevious(byte[] frame)
        {
            if (_previous == null || _previous.Length != frame.Length)
            {
                _previous = (byte[])frame.Clone();
                return false;
            }

            int diff = 0;
            int sampleStep = Math.Max(1, frame.Length / 4096); // sample at most 4096 points
            int samples = 0;
            for (int i = 0; i < frame.Length; i += sampleStep)
            {
                diff += Math.Abs(frame[i] - _previous[i]);
                samples++;
            }

            _previous = (byte[])frame.Clone();
            double changeRatio = (double)diff / (samples * 255);
            return changeRatio < SimilarityThreshold;
        }

        public void Reset() => _previous = null;
    }
}

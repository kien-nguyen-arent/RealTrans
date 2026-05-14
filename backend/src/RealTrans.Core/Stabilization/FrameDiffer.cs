using System;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Compares consecutive captures by raw byte difference ratio.
    /// Skips the OCR/translate pipeline when the frame hasn't changed meaningfully.
    /// </summary>
    public class FrameDiffer
    {
        private const double SimilarityThreshold = 0.05; // 5% change required to process

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

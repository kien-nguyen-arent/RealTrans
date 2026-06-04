using System;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Compares consecutive captures by raw byte difference ratio.
    /// Skips the OCR/translate pipeline when the frame hasn't changed meaningfully.
    ///
    /// This runs per capture on the hot path (ahead of OCR), and the diff only ever reads a
    /// bounded set of sampled offsets — so the baseline keeps just those sampled bytes (a few KB)
    /// instead of cloning the whole encoded frame on every call. The sample buffer is reused while
    /// the frame length is stable, making the steady state allocation-free.
    /// </summary>
    public class FrameDiffer
    {
        private const double SimilarityThreshold = 0.05; // 5% change required to process
        private const int MaxSamplePoints = 4096;

        private byte[]? _previousSamples; // bytes at the sampled offsets of the previous frame
        private int _previousLength = -1; // length of the previous frame (defines those offsets)

        public bool IsSimilarToPrevious(byte[] frame)
        {
            int sampleStep = Math.Max(1, frame.Length / MaxSamplePoints);
            int sampleCount = (frame.Length + sampleStep - 1) / sampleStep;

            if (_previousSamples == null || _previousLength != frame.Length)
            {
                // No baseline, or the encoded size changed (offsets can't be compared): treat as
                // a change and adopt this frame as the new baseline.
                _previousLength = frame.Length;
                if (_previousSamples == null || _previousSamples.Length != sampleCount)
                    _previousSamples = new byte[sampleCount];
                CopySamples(frame, sampleStep, _previousSamples);
                return false;
            }

            // Same length -> same sampleStep -> the stored samples line up with this frame's offsets.
            int diff = 0;
            int s = 0;
            for (int i = 0; i < frame.Length; i += sampleStep)
            {
                byte current = frame[i];
                diff += Math.Abs(current - _previousSamples[s]);
                _previousSamples[s] = current; // rebaseline in the same pass
                s++;
            }

            double changeRatio = (double)diff / (s * 255);
            return changeRatio < SimilarityThreshold;
        }

        public void Reset()
        {
            _previousSamples = null;
            _previousLength = -1;
        }

        private static void CopySamples(byte[] frame, int sampleStep, byte[] samples)
        {
            int s = 0;
            for (int i = 0; i < frame.Length; i += sampleStep)
                samples[s++] = frame[i];
        }
    }
}

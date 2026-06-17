using System;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Pixel-level processing gate that sits in front of the OCR/translate pipeline.
    ///
    /// Wraps <see cref="FrameDiffer"/> (raw byte comparison of consecutive captures) and adds a
    /// short "settle window": after a visual change the gate keeps admitting a few otherwise
    /// unchanged frames so the downstream text-level <see cref="StabilizationEngine"/> can reach
    /// its consecutive-frame quorum, then suppresses further frames while the region stays static.
    ///
    /// Goal: spend almost no CPU re-running OCR while a subtitle is unchanged, without starving the
    /// consecutive-frame stability check (which must OCR the same content more than once).
    ///
    /// Why the settle window is required: a bare "skip when this frame looks like the last one"
    /// gate would break translation. Once a subtitle is on screen its consecutive captures are
    /// identical, so the gate would skip OCR forever after the first frame and the
    /// <see cref="StabilizationEngine"/> (needing N consecutive identical OCR results) would never
    /// reach its quorum. The settle window deliberately lets the next few static frames through so
    /// the text gate can confirm, then goes quiet.
    ///
    /// Input note: captures arrive as encoded (TIFF) image bytes, not raw pixels. Identical
    /// bitmaps encode to identical byte streams, so the gate only ever suppresses frames that are
    /// byte-for-byte (or, under the 2.5% threshold, near-) identical to the previous capture — it
    /// never skips a genuine change. The decision is therefore conservative: when in doubt, process.
    /// </summary>
    public class FrameGate
    {
        private readonly FrameDiffer _differ;
        private readonly int _settleFrames;
        private int _settleCountdown;

        /// <param name="settleFrames">
        /// How many consecutive unchanged frames to keep admitting after a change before going
        /// quiet. The changed frame itself is also processed and already counts once toward the
        /// <see cref="StabilizationEngine"/> quorum, so the minimum that avoids starving the
        /// text-stability gate is its required consecutive-frame count minus one; passing the
        /// full count adds one frame of safety margin.
        /// </param>
        public FrameGate(int settleFrames = 2)
        {
            if (settleFrames < 1)
                throw new ArgumentOutOfRangeException(
                    nameof(settleFrames), "Settle window must admit at least one frame.");

            _differ = new FrameDiffer();
            _settleFrames = settleFrames;
        }

        /// <summary>
        /// Returns true if the OCR/translate pipeline should run for <paramref name="frame"/>,
        /// false to skip this capture (saving the OCR cost). Changed frames are always processed;
        /// while the region is static, up to <c>settleFrames</c> frames are admitted to let the
        /// downstream stability gate confirm, after which identical frames are suppressed.
        /// </summary>
        public bool ShouldProcess(byte[] frame)
        {
            // FrameDiffer.IsSimilarToPrevious returns true when the capture is (near-)identical to
            // the previous one; invert it so "changed" reads naturally.
            bool changed = !_differ.IsSimilarToPrevious(frame);
            if (changed)
            {
                // New content: arm the settle window and process this frame.
                _settleCountdown = _settleFrames;
                return true;
            }

            if (_settleCountdown > 0)
            {
                // Still unchanged, but inside the settle window: keep feeding the stability gate.
                _settleCountdown--;
                return true;
            }

            // Unchanged and the window is spent: suppress OCR until the pixels change again.
            return false;
        }

        /// <summary>Resets to the initial state; the next frame is always treated as a change.</summary>
        public void Reset()
        {
            _differ.Reset();
            _settleCountdown = 0;
        }
    }
}

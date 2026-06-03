using System.Threading;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Issues monotonically increasing sequence IDs per translation run.
    /// OverlayManager only applies a result if its sequence ID is &gt;= the last applied,
    /// preventing late-arriving translations from overwriting newer ones.
    /// </summary>
    public class TranslationSequencer
    {
        private uint _current;

        public uint Next() => Interlocked.Increment(ref _current);

        public bool ShouldApply(uint incoming, ref uint lastApplied)
        {
            if (incoming >= lastApplied)
            {
                Interlocked.Exchange(ref lastApplied, incoming);
                return true;
            }
            return false;
        }
    }
}

using RealTrans.Core.Stabilization;
using Xunit;

namespace RealTrans.Core.Tests
{
    public class FrameDifferTests
    {
        private static byte[] Fill(int length, byte value)
        {
            var buffer = new byte[length];
            for (int i = 0; i < length; i++) buffer[i] = value;
            return buffer;
        }

        [Fact]
        public void FirstFrame_IsNeverSimilar()
        {
            var differ = new FrameDiffer();

            // No baseline yet: the first frame must be treated as a change so it gets processed.
            Assert.False(differ.IsSimilarToPrevious(Fill(100, 0)));
        }

        [Fact]
        public void IdenticalFrame_IsSimilar()
        {
            var differ = new FrameDiffer();
            differ.IsSimilarToPrevious(Fill(100, 50)); // establish baseline

            Assert.True(differ.IsSimilarToPrevious(Fill(100, 50)));
        }

        [Fact]
        public void LargeChange_IsNotSimilar()
        {
            var differ = new FrameDiffer();
            differ.IsSimilarToPrevious(Fill(100, 0));

            // Every byte swings by the full range -> change ratio = 1.0, far above the 2.5% threshold.
            Assert.False(differ.IsSimilarToPrevious(Fill(100, 255)));
        }

        [Fact]
        public void SubThresholdChange_IsStillSimilar()
        {
            var differ = new FrameDiffer();
            var baseline = Fill(100, 100);
            differ.IsSimilarToPrevious(baseline);

            // Flip a single byte by the full range: diff/(100*255) ~= 0.01, under the 2.5% threshold.
            var almostSame = Fill(100, 100);
            almostSame[0] = 255;
            Assert.True(differ.IsSimilarToPrevious(almostSame));
        }

        [Fact]
        public void DifferentLength_IsNotSimilar_AndRebaselines()
        {
            var differ = new FrameDiffer();
            differ.IsSimilarToPrevious(Fill(100, 10));

            // A different length (e.g. encoded image whose size changed) can't be compared: treat as
            // a change and adopt the new frame as the baseline.
            Assert.False(differ.IsSimilarToPrevious(Fill(120, 10)));
            Assert.True(differ.IsSimilarToPrevious(Fill(120, 10)));
        }

        [Fact]
        public void Reset_TreatsNextFrameAsChange()
        {
            var differ = new FrameDiffer();
            differ.IsSimilarToPrevious(Fill(100, 7));
            Assert.True(differ.IsSimilarToPrevious(Fill(100, 7)));

            differ.Reset();
            Assert.False(differ.IsSimilarToPrevious(Fill(100, 7)));
        }
    }
}

using System;
using RealTrans.Core.Stabilization;
using Xunit;

namespace RealTrans.Core.Tests
{
    public class FrameGateTests
    {
        // Clearly-distinct fills so the FrameDiffer threshold unambiguously sees "changed".
        private static byte[] Frame(byte value)
        {
            var buffer = new byte[100];
            for (int i = 0; i < buffer.Length; i++) buffer[i] = value;
            return buffer;
        }

        [Fact]
        public void ChangedFrame_IsAlwaysProcessed()
        {
            var gate = new FrameGate(settleFrames: 2);

            Assert.True(gate.ShouldProcess(Frame(0)));    // first frame = change
            Assert.True(gate.ShouldProcess(Frame(200)));  // clearly different = change
            Assert.True(gate.ShouldProcess(Frame(100)));  // clearly different = change
        }

        [Fact]
        public void StaticFrames_AdmitSettleWindowThenSuppress()
        {
            var gate = new FrameGate(settleFrames: 2);

            // Change frame arms the window and is processed.
            Assert.True(gate.ShouldProcess(Frame(50)));
            // Two static frames are still admitted (so the text-stability gate can confirm)...
            Assert.True(gate.ShouldProcess(Frame(50)));
            Assert.True(gate.ShouldProcess(Frame(50)));
            // ...then the window is spent and identical frames are suppressed.
            Assert.False(gate.ShouldProcess(Frame(50)));
            Assert.False(gate.ShouldProcess(Frame(50)));
        }

        [Fact]
        public void ChangeReArmsTheSettleWindow()
        {
            var gate = new FrameGate(settleFrames: 2);

            gate.ShouldProcess(Frame(50));
            gate.ShouldProcess(Frame(50));
            gate.ShouldProcess(Frame(50));
            Assert.False(gate.ShouldProcess(Frame(50))); // suppressed

            // A new change re-opens the window.
            Assert.True(gate.ShouldProcess(Frame(200)));
            Assert.True(gate.ShouldProcess(Frame(200)));
            Assert.True(gate.ShouldProcess(Frame(200)));
            Assert.False(gate.ShouldProcess(Frame(200)));
        }

        [Fact]
        public void Reset_TreatsNextFrameAsChange()
        {
            var gate = new FrameGate(settleFrames: 2);
            gate.ShouldProcess(Frame(50));
            gate.ShouldProcess(Frame(50));
            gate.ShouldProcess(Frame(50));
            Assert.False(gate.ShouldProcess(Frame(50)));

            gate.Reset();
            Assert.True(gate.ShouldProcess(Frame(50)));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void Constructor_RejectsNonPositiveSettleWindow(int settleFrames)
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => new FrameGate(settleFrames));
        }

        [Fact]
        public void SettleWindowOfOne_AdmitsExactlyOneStaticFrame()
        {
            var gate = new FrameGate(settleFrames: 1);

            Assert.True(gate.ShouldProcess(Frame(50)));  // change
            Assert.True(gate.ShouldProcess(Frame(50)));  // single settle frame
            Assert.False(gate.ShouldProcess(Frame(50))); // suppressed
        }
    }
}

using System.Drawing;
using System.Linq;
using Translumo.OCR;
using Translumo.Processing.TextProcessing;
using Xunit;

namespace RealTrans.Core.Tests
{
    public class LayoutAnalyzerTests
    {
        // 20px-tall lines, 2px intra-paragraph gaps. With GapFactor 1.6 the paragraph
        // break threshold is 1.6 * max(2, 20) = 32px.
        private static OcrLine Line(string text, int y, int x = 0, int w = 100, int h = 20) =>
            new(text, new Rectangle(x, y, w, h));

        [Fact]
        public void WrappedParagraph_StaysOneBlock_JoinedWithSpaces()
        {
            var lines = new[]
            {
                Line("Hello", 0),
                Line("world", 22),
                Line("again", 44),
            };

            var blocks = LayoutAnalyzer.GroupIntoBlocks(lines, useSpaceRemover: false);

            var block = Assert.Single(blocks);
            Assert.Equal("Hello world again", block.Text);
        }

        [Fact]
        public void ParagraphsSeparatedByGap_SplitIntoTwoBlocks()
        {
            var lines = new[]
            {
                Line("First", 0),
                Line("para", 22),
                // 58px gap (100 - 42) > 32px threshold => new paragraph.
                Line("Second", 100),
                Line("block", 122),
            };

            var blocks = LayoutAnalyzer.GroupIntoBlocks(lines, useSpaceRemover: false);

            Assert.Equal(2, blocks.Count);
            Assert.Equal("First para", blocks[0].Text);
            Assert.Equal("Second block", blocks[1].Text);
        }

        [Fact]
        public void CjkLines_JoinWithoutSpaces_WhenSpaceRemoverOn()
        {
            var lines = new[]
            {
                Line("日本", 0, w: 40),
                Line("語", 22, w: 40),
            };

            var blocks = LayoutAnalyzer.GroupIntoBlocks(lines, useSpaceRemover: true);

            var block = Assert.Single(blocks);
            Assert.Equal("日本語", block.Text);
        }

        [Fact]
        public void TrailingHyphen_DeHyphenatesAcrossWrap()
        {
            var lines = new[]
            {
                Line("exam-", 0),
                Line("ple", 22),
            };

            var blocks = LayoutAnalyzer.GroupIntoBlocks(lines, useSpaceRemover: false);

            var block = Assert.Single(blocks);
            Assert.Equal("example", block.Text);
        }

        [Fact]
        public void EmptyOrNullInput_ReturnsNoBlocks()
        {
            Assert.Empty(LayoutAnalyzer.GroupIntoBlocks(new OcrLine[0], useSpaceRemover: false));
            Assert.Empty(LayoutAnalyzer.GroupIntoBlocks(null, useSpaceRemover: false));
        }

        [Fact]
        public void GeometrylessAndBlankLines_AreIgnored()
        {
            var lines = new[]
            {
                Line("kept", 0),
                new OcrLine("zero-rect-dropped", new Rectangle(0, 22, 0, 0)),
                Line("   ", 44),   // whitespace-only, dropped
            };

            var block = Assert.Single(LayoutAnalyzer.GroupIntoBlocks(lines, useSpaceRemover: false));
            Assert.Equal("kept", block.Text);
        }

        [Fact]
        public void Bounds_UnionAllLinesInBlock()
        {
            var lines = new[]
            {
                Line("a", 0, x: 10, w: 50, h: 20),   // L=10,T=0,R=60,B=20
                Line("b", 22, x: 5, w: 80, h: 20),   // L=5,T=22,R=85,B=42
            };

            var block = Assert.Single(LayoutAnalyzer.GroupIntoBlocks(lines, useSpaceRemover: false));
            Assert.Equal(Rectangle.FromLTRB(5, 0, 85, 42), block.Bounds);
        }

        [Fact]
        public void TooManyFragments_CollapseToSingleBlock_PerMaxBlocks()
        {
            // 7 lines each 80px apart => 7 paragraph fragments. With MaxBlocks=6 the
            // result collapses back to one block instead of 7 translate calls.
            var lines = Enumerable.Range(0, 7)
                .Select(i => Line($"p{i}", i * 100))
                .ToArray();

            var blocks = LayoutAnalyzer.GroupIntoBlocks(
                lines, useSpaceRemover: false, new LayoutOptions { MaxBlocks = 6 });

            var block = Assert.Single(blocks);
            Assert.Equal("p0 p1 p2 p3 p4 p5 p6", block.Text);
        }
    }
}

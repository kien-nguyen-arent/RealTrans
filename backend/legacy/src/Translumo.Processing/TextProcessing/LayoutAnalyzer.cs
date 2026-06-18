using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Translumo.OCR;

namespace Translumo.Processing.TextProcessing
{
    /// <summary>One detected paragraph: flowing text + its source-pixel bounding box.</summary>
    public readonly record struct LayoutBlock(string Text, Rectangle Bounds);

    /// <summary>Tunables for <see cref="LayoutAnalyzer.GroupIntoBlocks"/>.</summary>
    public sealed class LayoutOptions
    {
        /// <summary>
        /// A new paragraph starts when the vertical gap to the next line exceeds
        /// <c>GapFactor × max(medianGap, medianLineHeight)</c>. ~1.6 separates normal
        /// line spacing from a real paragraph break without over-splitting.
        /// </summary>
        public double GapFactor { get; init; } = 1.6;

        /// <summary>Join a wrapped Latin word split by a trailing hyphen ("exam-" + "ple" ⇒ "example").</summary>
        public bool DeHyphenate { get; init; } = true;

        /// <summary>
        /// Upper bound on paragraphs per frame, to bound translate fan-out. When exceeded,
        /// everything collapses back into a single block (reading order preserved).
        /// </summary>
        public int MaxBlocks { get; init; } = 6;

        public static LayoutOptions Default { get; } = new();
    }

    /// <summary>
    /// Groups OCR lines (with geometry) into coherent paragraphs so each can be
    /// translated and rendered as one overlay block. Pure / deterministic — no I/O,
    /// no statics beyond a compiled regex — so it's cheap to unit-test.
    ///
    /// v1 splits on VERTICAL GAPS only (the common case: paragraphs separated by extra
    /// vertical space). Indentation- and column-based splitting are intentionally left
    /// out: they easily over-split prose (e.g. a first-line indent would detach the
    /// first line from its own paragraph), which hurts readability more than the
    /// occasional under-split. Revisit if real content needs it.
    /// </summary>
    public static class LayoutAnalyzer
    {
        private static readonly Regex MultipleSpaces = new(@"[ \t]{2,}", RegexOptions.Compiled);

        public static IReadOnlyList<LayoutBlock> GroupIntoBlocks(
            IReadOnlyList<OcrLine> lines, bool useSpaceRemover, LayoutOptions options = null)
        {
            options ??= LayoutOptions.Default;

            // Reading order: top-to-bottom, then left-to-right. Drop geometry-less /
            // blank lines (they can't be positioned and add nothing to read).
            var sorted = (lines ?? Array.Empty<OcrLine>())
                .Where(l => l.Bounds.Width > 0 && l.Bounds.Height > 0 && !string.IsNullOrWhiteSpace(l.Text))
                .OrderBy(l => l.Bounds.Top)
                .ThenBy(l => l.Bounds.Left)
                .ToList();

            if (sorted.Count == 0) return Array.Empty<LayoutBlock>();
            if (sorted.Count == 1) return new[] { JoinBlock(sorted, useSpaceRemover, options) };

            double medianH = Median(sorted.Select(l => (double)l.Bounds.Height));
            var gaps = new List<double>();
            for (int i = 1; i < sorted.Count; i++)
            {
                double g = sorted[i].Bounds.Top - sorted[i - 1].Bounds.Bottom;
                if (g > 0) gaps.Add(g);
            }
            double medianGap = gaps.Count > 0 ? Median(gaps) : 0;
            double gapThreshold = options.GapFactor * Math.Max(medianGap, medianH);

            var blocks = new List<LayoutBlock>();
            var current = new List<OcrLine> { sorted[0] };
            for (int i = 1; i < sorted.Count; i++)
            {
                double vGap = sorted[i].Bounds.Top - sorted[i - 1].Bounds.Bottom;
                if (vGap > gapThreshold)
                {
                    blocks.Add(JoinBlock(current, useSpaceRemover, options));
                    current = new List<OcrLine> { sorted[i] };
                }
                else
                {
                    current.Add(sorted[i]);
                }
            }
            blocks.Add(JoinBlock(current, useSpaceRemover, options));

            // Bound translate fan-out: if a frame fragments into too many blocks, fall
            // back to one block rather than firing a translate call per fragment.
            if (options.MaxBlocks > 0 && blocks.Count > options.MaxBlocks)
                return new[] { JoinBlock(sorted, useSpaceRemover, options) };

            return blocks;
        }

        // Joins a paragraph's wrapped lines into flowing text and unions their boxes.
        private static LayoutBlock JoinBlock(IReadOnlyList<OcrLine> blockLines, bool useSpaceRemover, LayoutOptions options)
        {
            var sb = new StringBuilder();
            for (int k = 0; k < blockLines.Count; k++)
            {
                string text = blockLines[k].Text ?? string.Empty;
                if (k == 0) { sb.Append(text); continue; }

                if (options.DeHyphenate && EndsWithLetterHyphen(sb))
                    sb.Length -= 1;            // drop hyphen, glue the word halves
                else if (!useSpaceRemover)
                    sb.Append(' ');            // Latin: space between wrapped lines
                // CJK (useSpaceRemover): no separator
                sb.Append(text);
            }

            string joined = MultipleSpaces.Replace(sb.ToString(), " ").Trim();
            return new LayoutBlock(joined, Union(blockLines));
        }

        private static bool EndsWithLetterHyphen(StringBuilder sb) =>
            sb.Length >= 2 && sb[sb.Length - 1] == '-' && char.IsLetter(sb[sb.Length - 2]);

        private static Rectangle Union(IReadOnlyList<OcrLine> lines)
        {
            int minX = int.MaxValue, minY = int.MaxValue, maxX = int.MinValue, maxY = int.MinValue;
            foreach (var l in lines)
            {
                var b = l.Bounds;
                if (b.Left < minX) minX = b.Left;
                if (b.Top < minY) minY = b.Top;
                if (b.Right > maxX) maxX = b.Right;
                if (b.Bottom > maxY) maxY = b.Bottom;
            }
            return Rectangle.FromLTRB(minX, minY, maxX, maxY);
        }

        private static double Median(IEnumerable<double> values)
        {
            var arr = values.ToArray();
            if (arr.Length == 0) return 0;
            Array.Sort(arr);
            int mid = arr.Length / 2;
            return arr.Length % 2 == 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2.0;
        }
    }
}

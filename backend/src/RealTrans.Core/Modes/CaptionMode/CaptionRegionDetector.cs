using System.Collections.Generic;
using System.Drawing;
using RealTrans.Core.Regions;

namespace RealTrans.Core.Modes.CaptionMode
{
    /// <summary>
    /// Fixed bottom-strip detector for Caption mode (anime, VLC, streaming video).
    /// No OpenCV needed — subtitles are predictably in the lower 22% of the frame.
    /// </summary>
    public class CaptionRegionDetector : IRegionDetector
    {
        private const double StripHeightRatio = 0.22;
        private const double StripWidthRatio = 0.84;

        public IEnumerable<DetectedRegion> DetectRegions(Rectangle monitoredArea)
        {
            int stripHeight = (int)(monitoredArea.Height * StripHeightRatio);
            int stripWidth = (int)(monitoredArea.Width * StripWidthRatio);
            int stripX = monitoredArea.X + (monitoredArea.Width - stripWidth) / 2;
            int stripY = monitoredArea.Y + monitoredArea.Height - stripHeight;

            yield return new DetectedRegion(
                Id: "caption-band",
                Label: "Caption band",
                PixelRect: new Rectangle(stripX, stripY, stripWidth, stripHeight),
                IsAuto: true,
                IsPrimary: true,
                IsLive: true,
                IsPinnable: true);
        }
    }
}

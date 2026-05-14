using System.Drawing;

namespace RealTrans.Core.Regions
{
    public record ScreenRegion(string Id, string Label, Rectangle PixelRect);

    public record DetectedRegion(
        string Id,
        string Label,
        Rectangle PixelRect,
        bool IsAuto,
        bool IsPrimary,
        bool IsLive,
        bool IsPinnable);
}

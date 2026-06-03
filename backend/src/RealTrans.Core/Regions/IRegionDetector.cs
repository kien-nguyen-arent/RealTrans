using System.Collections.Generic;
using System.Drawing;

namespace RealTrans.Core.Regions
{
    public interface IRegionDetector
    {
        IEnumerable<DetectedRegion> DetectRegions(Rectangle monitoredArea);
    }
}

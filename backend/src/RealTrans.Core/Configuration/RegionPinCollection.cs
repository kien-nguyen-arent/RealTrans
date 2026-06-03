using System.Collections.Generic;
using System.Drawing;

namespace RealTrans.Core.Configuration
{
    public class RegionPinConfiguration
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string ScenarioId { get; set; } = string.Empty;
        public int X { get; set; }
        public int Y { get; set; }
        public int W { get; set; }
        public int H { get; set; }
    }

    public class RegionPinCollection
    {
        public List<RegionPinConfiguration> Pins { get; set; } = new();
    }
}

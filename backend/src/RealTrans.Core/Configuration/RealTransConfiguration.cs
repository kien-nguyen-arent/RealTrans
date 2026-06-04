namespace RealTrans.Core.Configuration
{
    public class RealTransConfiguration
    {
        public string ActiveScenarioId { get; set; } = "caption";
        public string RenderMode { get; set; } = "inline";
        public string AccentHue { get; set; } = "violet";
        public bool ShowHotkeyHint { get; set; } = true;
        public int SubtitleFontSize { get; set; } = 26;
        public bool AutoClearSubtitles { get; set; } = true;

        public static RealTransConfiguration Default => new();
    }
}

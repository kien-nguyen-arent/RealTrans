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

        /// <summary>
        /// Bumped on app startup when RealTrans defaults have been applied to
        /// the legacy translation/OCR configs. Stays false on first run with a
        /// fresh persisted file OR on a file that was originally saved by the
        /// legacy Translumo app (which doesn't write this property), so the
        /// startup migration knows to overwrite the legacy defaults
        /// (EN→RU + DeepL + all engines disabled) with RealTrans defaults
        /// (EN→VI + Google + WindowsOCR enabled).
        /// </summary>
        public int DefaultsSchemaVersion { get; set; }

        public static RealTransConfiguration Default => new();
    }
}

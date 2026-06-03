using System.Collections.Generic;
using System.Linq;

namespace RealTrans.Core.Configuration
{
    /// <summary>
    /// A single UI preference (toggle / select / chip) persisted from the settings panel.
    /// Stored as a flat key/value list because XmlSerializer (used by ConfigurationStorage)
    /// cannot serialize a Dictionary. Values are stringified ("true"/"false" for toggles).
    /// </summary>
    public class UiPreferenceEntry
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    public class RealTransConfiguration
    {
        public string ActiveScenarioId { get; set; } = "anime";
        public string RenderMode { get; set; } = "replace";
        public string AccentHue { get; set; } = "violet";
        public bool ShowHotkeyHint { get; set; } = true;
        public int SubtitleFontSize { get; set; } = 26;
        public bool AutoClearSubtitles { get; set; } = true;

        /// <summary>
        /// Arbitrary UI settings from the settings panel (e.g. matchTypography, telemetry,
        /// targetLang). These round-trip to the web UI as a flat object and are persisted.
        /// Backend-meaningful values (renderMode, activeScenarioId) are mirrored into the
        /// typed properties above by <c>UiSettingsCoordinator</c>.
        /// </summary>
        public List<UiPreferenceEntry> UiPreferences { get; set; } = new();

        public static RealTransConfiguration Default => new();

        /// <summary>Upsert a UI preference by key.</summary>
        public void SetPreference(string key, string value)
        {
            var existing = UiPreferences.FirstOrDefault(p => p.Key == key);
            if (existing != null) existing.Value = value;
            else UiPreferences.Add(new UiPreferenceEntry { Key = key, Value = value });
        }

        /// <summary>Flatten typed fields + UiPreferences into one dictionary for the web UI.</summary>
        public Dictionary<string, string> ToSettingsDictionary()
        {
            var dict = new Dictionary<string, string>
            {
                ["renderMode"] = RenderMode,
                ["activeScenarioId"] = ActiveScenarioId,
                ["accentHue"] = AccentHue,
                ["showHotkeyHint"] = ShowHotkeyHint ? "true" : "false",
                ["subtitleFontSize"] = SubtitleFontSize.ToString(),
                ["autoClearSubtitles"] = AutoClearSubtitles ? "true" : "false",
            };
            foreach (var p in UiPreferences)
                dict[p.Key] = p.Value;
            return dict;
        }
    }
}

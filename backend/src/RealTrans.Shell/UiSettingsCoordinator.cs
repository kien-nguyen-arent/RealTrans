using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Windows.Input;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.Configuration;
using Translumo.Configuration;
using Translumo.HotKeys;

namespace RealTrans.Shell
{
    /// <summary>
    /// Bridges the web settings panel to the persisted configuration, the region-pin
    /// collection, and the global hotkey manager.
    ///
    /// Subscribes to the WebMessageBus channels that previously had NO consumer:
    ///   app:ready       → push current state to the freshly-loaded UI (state:init)
    ///   settings:get    → push a settings snapshot
    ///   settings:set    → apply one {key,value} change, persist, echo back a snapshot
    ///   hotkey:reassign → rebind a global hotkey
    ///   region:pin      → add a pinned region, persist, push state
    ///   region:unpin    → remove a pinned region, persist, push state
    ///
    /// Must be resolved at startup (see App.OnStartup) so these subscriptions attach
    /// before the WebView sends its first message.
    /// </summary>
    public class UiSettingsCoordinator
    {
        private readonly WebMessageBus _bus;
        private readonly RealTransConfiguration _config;
        private readonly RegionPinCollection _pins;
        private readonly RealTransHotKeyManager _hotkeys;
        private readonly ConfigurationStorage _storage;
        private readonly ILogger<UiSettingsCoordinator> _logger;

        public UiSettingsCoordinator(
            WebMessageBus bus,
            RealTransConfiguration config,
            RegionPinCollection pins,
            RealTransHotKeyManager hotkeys,
            ConfigurationStorage storage,
            ILogger<UiSettingsCoordinator> logger)
        {
            _bus = bus;
            _config = config;
            _pins = pins;
            _hotkeys = hotkeys;
            _storage = storage;
            _logger = logger;

            _bus.AppReady       += OnAppReady;
            _bus.SettingsGet    += OnSettingsGet;
            _bus.SettingsSet    += OnSettingsSet;
            _bus.HotkeyReassign += OnHotkeyReassign;
            _bus.RegionPin      += OnRegionPin;
            _bus.RegionUnpin    += OnRegionUnpin;
        }

        // ── handlers ──────────────────────────────────────────────────────────

        private void OnAppReady(object? sender, EventArgs e) => PublishState();

        private void OnSettingsGet(object? sender, InboundMessage msg) => PublishSnapshot();

        private void OnSettingsSet(object? sender, InboundMessage msg)
        {
            try
            {
                var key = GetString(msg.Payload, "key");
                if (string.IsNullOrEmpty(key))
                {
                    _logger.LogWarning("settings:set with no key");
                    return;
                }

                var value = StringifyValue(msg.Payload, "value");
                ApplySetting(key!, value);
                Persist();
                PublishSnapshot(); // echo so the UI confirms the persisted value
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "settings:set failed");
                _bus.Publish(new ErrorMessage("settings-set-failed", ex.Message));
            }
        }

        private void OnHotkeyReassign(object? sender, InboundMessage msg)
        {
            try
            {
                var action = GetString(msg.Payload, "action") ?? "";
                var keyStr = GetString(msg.Payload, "key") ?? "";
                var modifiers = ParseModifiers(msg.Payload);

                if (!TryParseKey(keyStr, out var key))
                {
                    _logger.LogWarning("hotkey:reassign — could not parse key '{Key}'", keyStr);
                    return;
                }

                switch (action)
                {
                    case "openPalette":
                    case "activate":
                        _hotkeys.UpdatePaletteKey(key, modifiers);
                        break;
                    case "toggleOverlay":
                        _hotkeys.UpdateOverlayKey(key, modifiers);
                        break;
                    default:
                        _logger.LogDebug("hotkey:reassign — action '{Action}' has no global binding; stored as UI pref only", action);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "hotkey:reassign failed");
                _bus.Publish(new ErrorMessage("hotkey-reassign-failed", ex.Message));
            }
        }

        private void OnRegionPin(object? sender, InboundMessage msg)
        {
            try
            {
                var pin = new RegionPinConfiguration
                {
                    Id = GetString(msg.Payload, "id") ?? Guid.NewGuid().ToString("N"),
                    Label = GetString(msg.Payload, "label") ?? "Pinned region",
                    ScenarioId = GetString(msg.Payload, "scenarioId") ?? _config.ActiveScenarioId,
                    X = GetInt(msg.Payload, "x"),
                    Y = GetInt(msg.Payload, "y"),
                    W = GetInt(msg.Payload, "w"),
                    H = GetInt(msg.Payload, "h"),
                };
                _pins.Pins.RemoveAll(p => p.Id == pin.Id);
                _pins.Pins.Add(pin);
                Persist();
                PublishState();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "region:pin failed");
                _bus.Publish(new ErrorMessage("region-pin-failed", ex.Message));
            }
        }

        private void OnRegionUnpin(object? sender, InboundMessage msg)
        {
            try
            {
                var id = GetString(msg.Payload, "id");
                if (!string.IsNullOrEmpty(id))
                {
                    _pins.Pins.RemoveAll(p => p.Id == id);
                    Persist();
                    PublishState();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "region:unpin failed");
                _bus.Publish(new ErrorMessage("region-unpin-failed", ex.Message));
            }
        }

        // ── apply / persist / publish ───────────────────────────────────────────

        private void ApplySetting(string key, string value)
        {
            // Mirror backend-meaningful keys into typed config fields, then always
            // store the raw value in the UI preference bag so the panel round-trips.
            switch (key)
            {
                case "renderMode":
                case "renderStyle":
                    _config.RenderMode = value;
                    _config.SetPreference("renderMode", value);
                    _config.SetPreference("renderStyle", value);
                    return;
                case "activeScenarioId":
                case "scenario":
                    _config.ActiveScenarioId = value;
                    _config.SetPreference("activeScenarioId", value);
                    return;
                case "showHotkeyHint":
                    _config.ShowHotkeyHint = value == "true";
                    break;
                case "autoClearSubtitles":
                case "stabilizeSubtitles":
                    _config.AutoClearSubtitles = value == "true";
                    break;
                case "subtitleFontSize":
                    if (int.TryParse(value, out var fs)) _config.SubtitleFontSize = fs;
                    break;
                case "accentHue":
                    _config.AccentHue = value;
                    break;
            }
            _config.SetPreference(key, value);
        }

        private void Persist()
        {
            try { _storage.SaveConfiguration(); }
            catch (Exception ex) { _logger.LogError(ex, "Failed to persist configuration"); }
        }

        private void PublishState()
        {
            _bus.Publish(new StateInitMessage(
                _config.ToSettingsDictionary(),
                _pins.Pins,
                _config.ActiveScenarioId,
                _config.RenderMode));
        }

        private void PublishSnapshot()
        {
            _bus.Publish(new SettingsSnapshotMessage(_config.ToSettingsDictionary()));
        }

        // ── JSON helpers ─────────────────────────────────────────────────────────

        private static string? GetString(JsonElement payload, string name) =>
            payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
                ? el.GetString()
                : null;

        private static int GetInt(JsonElement payload, string name) =>
            payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number
                ? el.GetInt32()
                : 0;

        /// <summary>Coerce a payload value of any JSON kind to a string ("true"/"false"/number/text).</summary>
        private static string StringifyValue(JsonElement payload, string name)
        {
            if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty(name, out var el))
                return "";
            return el.ValueKind switch
            {
                JsonValueKind.String => el.GetString() ?? "",
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Number => el.GetRawText(),
                JsonValueKind.Null => "",
                _ => el.GetRawText(),
            };
        }

        private static KeyModifier ParseModifiers(JsonElement payload)
        {
            var mods = KeyModifier.None;
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty("modifiers", out var arr) &&
                arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var m in arr.EnumerateArray())
                {
                    var s = m.GetString()?.Trim().ToLowerInvariant();
                    switch (s)
                    {
                        case "alt": case "⌥": case "option": mods |= KeyModifier.Alt; break;
                        case "ctrl": case "control": case "⌃": mods |= KeyModifier.Ctrl; break;
                        case "shift": case "⇧": mods |= KeyModifier.Shift; break;
                        case "win": case "cmd": case "meta": case "⌘": mods |= KeyModifier.Win; break;
                    }
                }
            }
            return mods;
        }

        private static bool TryParseKey(string raw, out Key key)
        {
            key = Key.None;
            if (string.IsNullOrWhiteSpace(raw)) return false;
            var s = raw.Trim();

            // Single digit → Dn
            if (s.Length == 1 && char.IsDigit(s[0]))
                s = "D" + s;

            // Common symbols mapped to OEM keys
            switch (s)
            {
                case "~": case "`": key = Key.Oem3; return true;
                case ".": key = Key.OemPeriod; return true;
                case ",": key = Key.OemComma; return true;
                case " ": case "Space": key = Key.Space; return true;
            }

            return Enum.TryParse(s, ignoreCase: true, out key) && key != Key.None;
        }
    }
}

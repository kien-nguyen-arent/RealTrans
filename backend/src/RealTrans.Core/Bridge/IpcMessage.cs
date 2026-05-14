using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RealTrans.Core.Bridge
{
    // ── Inbound (JS → C#) ────────────────────────────────────────────────────

    public record InboundMessage(string Type, JsonElement Payload);

    // ── Outbound (C# → JS) ───────────────────────────────────────────────────

    public abstract record OutboundMessage
    {
        [JsonPropertyName("type")]
        public abstract string Type { get; }
    }

    public record StateInitMessage(object Settings, object PinnedRegions, string ActiveScenario, string RenderMode)
        : OutboundMessage
    {
        public override string Type => "state:init";
    }

    public record HotkeyFiredMessage(string Action) : OutboundMessage
    {
        public override string Type => "hotkey:fired";
    }

    public record RegionsDetectedMessage(string ScenarioId, IEnumerable<RegionDto> Regions)
        : OutboundMessage
    {
        public override string Type => "regions:detected";
    }

    public record TranslationStartedMessage(string RegionId) : OutboundMessage
    {
        public override string Type => "translation:started";
    }

    public record TranslationResultMessage(
        string RegionId,
        string SourceText,
        string TranslatedText,
        int ElapsedMs,
        string RenderMode) : OutboundMessage
    {
        public override string Type => "translation:result";
    }

    public record TranslationClearedMessage(string RegionId) : OutboundMessage
    {
        public override string Type => "translation:cleared";
    }

    public record OverlayUpdateMessage(
        string RegionId,
        RectDto Rect,
        string RenderMode,
        string TranslatedText,
        uint SequenceId) : OutboundMessage
    {
        public override string Type => "overlay:update";
    }

    public record SettingsSnapshotMessage(object Settings) : OutboundMessage
    {
        public override string Type => "settings:snapshot";
    }

    public record ErrorMessage(string Code, string Message) : OutboundMessage
    {
        public override string Type => "error";
    }

    // ── Shared DTOs ───────────────────────────────────────────────────────────

    public record RegionDto(
        string Id,
        string Label,
        int X, int Y, int W, int H,
        bool Auto,
        bool Primary,
        bool Live,
        bool Pinnable);

    public record RectDto(int X, int Y, int W, int H);
}

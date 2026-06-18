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
        uint SequenceId,
        // Tight bounding box of the detected source text, in screen pixels. When
        // present, OverlayManager positions the overlay here (over the original
        // text) instead of across the whole capture Rect. Null when the OCR engine
        // reports no geometry — overlay then falls back to Rect.
        RectDto? TextRect = null,
        // Per-paragraph translated blocks (text + screen-pixel box), in reading order.
        // When present, OverlayManager renders one overlay per block placed over its
        // source paragraph. Null/empty ⇒ single-block path using TranslatedText +
        // TextRect/Rect (engines without per-line geometry, e.g. Tesseract/EasyOCR).
        IReadOnlyList<OverlayBlock>? Blocks = null) : OutboundMessage
    {
        public override string Type => "overlay:update";
    }

    /// <summary>
    /// Tells OverlayManager to close the overlay window for a region when its
    /// session stops. Overlay windows are click-through, so the user can't dismiss
    /// them — without this they linger on screen after Stop/ESC.
    /// </summary>
    public record OverlayCloseMessage(string RegionId) : OutboundMessage
    {
        public override string Type => "overlay:close";
    }

    /// <summary>
    /// Toggles overlay visibility WITHOUT destroying the window. Published by the
    /// session on motion onset (Visible=false) so the overlay stops "floating" over
    /// content that's scrolling underneath it. Visibility is restored implicitly by
    /// the next <see cref="OverlayUpdateMessage"/> once the frame settles, so the
    /// overlay reappears already carrying fresh text (no stale-text flash). Distinct
    /// from <see cref="TranslationClearedMessage"/>, whose 600 ms hold-timer
    /// semantics OverlayManager deliberately ignores.
    /// </summary>
    public record OverlayVisibilityMessage(string RegionId, bool Visible) : OutboundMessage
    {
        public override string Type => "overlay:visibility";
    }

    public record SelectionCommittedMessage(RectDto Rect) : OutboundMessage
    {
        public override string Type => "selection:committed";
    }

    public record SelectionCancelledMessage() : OutboundMessage
    {
        public override string Type => "selection:cancelled";
    }

    public record SettingsSnapshotMessage(object Settings) : OutboundMessage
    {
        public override string Type => "settings:snapshot";
    }

    public record ErrorMessage(string Code, string Message) : OutboundMessage
    {
        public override string Type => "error";
    }

    /// <summary>
    /// Non-fatal status update routed to the JS feed as a muted row.
    /// Level: "info" (e.g. "Translation started"), "warn", or "success".
    /// </summary>
    public record StatusMessage(string Level, string Text) : OutboundMessage
    {
        public override string Type => "status";
    }

    /// <summary>
    /// Raw OCR output as the engine reads it — emitted even when the validity
    /// score is below the translation threshold. The Inline render mode displays
    /// this in the Original half so the user can verify the OCR is reading
    /// SOMETHING. Throttled by the publisher (typically 1 Hz) to avoid flooding
    /// the IPC bus on the ~8 Hz OCR loop.
    /// Superseded by <see cref="OcrTickMessage"/> — kept for compat; not emitted.
    /// </summary>
    public record OcrPreviewMessage(string RegionId, string Text) : OutboundMessage
    {
        public override string Type => "ocr:preview";
    }

    /// <summary>
    /// Per-iteration OCR telemetry. Emitted on EVERY GetText call (throttled 2 Hz),
    /// regardless of whether OCR returned text. Lets the UI prove the OCR loop is
    /// alive: incrementing iteration counter, non-zero capture bytes, char count,
    /// validity score, and engine type.
    /// </summary>
    public record OcrTickMessage(
        string RegionId,
        long Iteration,
        int CaptureBytes,
        string Text,
        int CharCount,
        double ValidityScore,
        string EngineName,
        string LastCapturePath) : OutboundMessage
    {
        public override string Type => "ocr:tick";
    }

    /// <summary>
    /// Live thumbnail of the captured region (≤200 px wide PNG, base64-encoded).
    /// Emitted at ~0.5 Hz by the OCR previewing provider. Gives the user visual
    /// proof that capture is targeting the correct pixels.
    /// </summary>
    public record CaptureThumbnailMessage(
        string RegionId,
        string Base64Png,
        int Width,
        int Height) : OutboundMessage
    {
        public override string Type => "capture:thumbnail";
    }

    /// <summary>
    /// Snapshot of user-facing translation settings — sent on app:ready so JS can
    /// initialize its UI to match the C# state (which may have been mutated by
    /// ConfigurationStorage.LoadConfiguration after DI defaults applied).
    /// </summary>
    public record SettingsStateMessage(
        string SourceLang,
        string TargetLang,
        string Translator,
        System.Collections.Generic.Dictionary<string, bool> OcrEngines)
        : OutboundMessage
    {
        public override string Type => "settings:state";
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

    /// <summary>
    /// One translated paragraph + its screen-pixel box. Carried by
    /// <see cref="OverlayUpdateMessage.Blocks"/> so OverlayManager can render one
    /// overlay per paragraph, each placed over its source text.
    /// </summary>
    public record OverlayBlock(string Text, RectDto Rect);
}

# RealTrans.Core

Cross-cutting orchestration layer. Bridges the WPF shell + the legacy Translumo
pipeline. Owns the JS↔C# message bus, hot keys, session lifecycle, OCR-result
stabilization, region pinning, and the configuration model.

This project is platform-agnostic at the language level (no XAML) but targets
`net8.0-windows10.0.19041.0` so it can call `Windows.Media.Ocr` for language
support probing.

## Folder map

| Folder | What's inside |
|---|---|
| [Bridge/](Bridge/) | `WebMessageBus`, `IpcMessage` records, `WebTranslationResultSink` |
| [Orchestration/](Orchestration/) | `SessionManager`, `TranslationSession`, `OcrLanguageProbe` |
| [HotKeys/](HotKeys/) | `RealTransHotKeyManager`, `HotKey` (Win32 `RegisterHotKey` wrapper) |
| [Stabilization/](Stabilization/) | `FrameDiffer`, `StabilizationEngine`, `SubtitleHoldTimer`, `TranslationSequencer` |
| [Capture/](Capture/) | `ScreenCapturerFactory` (DX + BitBlt), `BitBltScreenCapture`, `ScreenDXCapturer`, `BitmapExtensions` |
| [Regions/](Regions/) | `ScreenRegion`, `IRegionDetector` |
| [Modes/](Modes/) | Mode-specific glue (currently `CaptionMode/CaptionRegionDetector`) |
| [Configuration/](Configuration/) | `RealTransConfiguration` (UI prefs), `RegionPinCollection` (persisted pinned regions) |
| [DPI/](DPI/) | `DpiHelper` for WPF↔physical-pixel conversion |

## Bridge

[`WebMessageBus`](Bridge/WebMessageBus.cs) is the central event hub. It exposes
strongly-typed events per inbound message type (`SessionStart`, `SessionStop`,
`SelectionOpen`, etc.) and a single `OutboundReady` event that the shell window
serializes and forwards to the WebView2 control. Wire contract is documented in
[`../RealTrans.Shell/README.md`](../RealTrans.Shell/README.md#ipc-js--c).

[`WebTranslationResultSink`](Bridge/WebTranslationResultSink.cs) implements the
legacy `ITranslationResultSink` + `IChatTextMediator` interfaces. It bridges the
old chat-window-centric mediator pattern to the new IPC bus:

- `SendRegionResult` → `TranslationResultMessage` + `OverlayUpdateMessage`
- `SendText(text, successful=false)` → `ErrorMessage`
- `SendText(text, successful=true)` or `SendText(text, TextTypes.Info)` → `StatusMessage("info", …)`
- `SendText(text, TextTypes.Error)` → `ErrorMessage`

Without that error/status wiring, lifecycle messages from the legacy pipeline
(e.g. *"No OCR engine is selected!"*) would be silently dropped — the user would
click Start and see nothing.

## Orchestration

[`SessionManager`](Orchestration/SessionManager.cs) owns the dictionary of
active sessions, keyed by region id. On `session:start`:

1. Calls [`OcrLanguageProbe`](Orchestration/OcrLanguageProbe.cs) to confirm the
   selected source-language OCR pack is installed. If not, publishes an
   actionable `ErrorMessage` and aborts — no session created.
2. Resolves a fresh `TranslationProcessingService` from the DI container
   (registered transient), sets per-session `RegionId`, `CaptureArea`,
   `IterationDelayOverrideMs`, and `StabilityCheck`.
3. Constructs a [`TranslationSession`](Orchestration/TranslationSession.cs) that
   owns the per-region stabilization stack and the subtitle hold timer.
4. Calls `TranslationSession.Start()` → `processingService.StartProcessing()`.

On `session:stop`, all sessions are disposed; each session disposes its
processing service (which cancels the loop) and unsubscribes from the bus.

### OcrLanguageProbe

[`OcrLanguageProbe`](Orchestration/OcrLanguageProbe.cs) catches the silent-no-op
failure mode where `Windows.Media.Ocr.OcrEngine.TryCreateFromLanguage` returns
null for an uninstalled language pack. Without the probe, `WindowsOCREngine`
keeps a null `MsEngine` and every `GetTextLines` returns `[]` — `ValidityScore`
stays at 0 and no translation ever fires. The probe asks
`OcrEngine.IsLanguageSupported(new Language(code))` and returns an
`OcrLanguageReadiness` record. SessionManager publishes the failure as an
`error` IPC message with `code: "ocr-language-unavailable"` and installation
instructions.

## Stabilization

The legacy pipeline polls the screen every ~120 ms. To avoid translating noise
(flickering subtitles, half-rendered frames), `TranslationSession` plugs three
helpers into `TranslationProcessingService.StabilityCheck`:

- [`FrameDiffer`](Stabilization/FrameDiffer.cs) — quick hash diff between
  consecutive frames; suppresses identical frames.
- [`StabilizationEngine`](Stabilization/StabilizationEngine.cs) — requires N
  consecutive identical OCR results before allowing a translation call. Used
  as `StabilityCheck` predicate.
- [`SubtitleHoldTimer`](Stabilization/SubtitleHoldTimer.cs) — keeps the overlay
  visible for ~600 ms after the last result, so flicker between adjacent
  subtitle frames doesn't cause the overlay to blink. Fires
  `TranslationClearedMessage` when the hold expires.
- [`TranslationSequencer`](Stabilization/TranslationSequencer.cs) — monotonic
  ticket so late-arriving translation results can be dropped in
  `OverlayManager`.

## Capture

Mirrors the legacy `IScreenCapturer` interface for code that wants to capture
from `RealTrans.Core` directly (the bulk of capture is still done inside
`TranslationProcessingService`, but the factory + types live here so other
features — preview thumbnails, frozen background screenshots — can reuse them).

## HotKeys

[`RealTransHotKeyManager`](HotKeys/RealTransHotKeyManager.cs) registers global
hotkeys via the legacy `Translumo.HotKeys.HotKey` wrapper around Win32
`RegisterHotKey`. Defaults:

| Hotkey | Event |
|---|---|
| `Alt+Q` | `OpenPalettePressed` |
| `~` (Oem3) | `ToggleOverlayPressed` |

The shell window subscribes to both events and forwards them as
`HotkeyFiredMessage` over the bus, where `app.jsx` maps `openPalette` to the
command palette and `toggleOverlay` to the same handler as the Start button.

## Configuration

[`RealTransConfiguration`](Configuration/RealTransConfiguration.cs) is the
shell-owned config: render mode, accent hue, subtitle font size, etc. Distinct
from the legacy `TranslationConfiguration` / `OcrGeneralConfiguration` /
`TtsConfiguration` (which still live in the Translumo namespace and are
persisted by the legacy `ConfigurationStorage`). Both are serialized to
`%APPDATA%/RealTrans/settings`.

[`RegionPinCollection`](Configuration/RegionPinCollection.cs) persists user-
pinned regions so the next session can restart them automatically.

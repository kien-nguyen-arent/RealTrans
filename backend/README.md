# RealTrans — Backend

In-place screen-translation overlay for Windows. The user picks a region of their
screen with a global hotkey or the on-screen button, and RealTrans overlays a
live translation on top of the original content.

The visual spec is in [../prototype/README.md](../prototype/README.md) — this
folder is the production implementation of that design.

## Solution layout

| Path | Purpose |
|---|---|
| [RealTrans.sln](RealTrans.sln) | VS solution wiring all projects together |
| [src/RealTrans.Shell/](src/RealTrans.Shell/) | WPF app entry, WebView2-hosted React UI, selection overlay window |
| [src/RealTrans.Core/](src/RealTrans.Core/) | Orchestration, IPC bridge, hotkeys, stabilization, capture, region pinning |
| [src/RealTrans.Overlay/](src/RealTrans.Overlay/) | Per-region translation-overlay windows (Replace, Ghost, etc.) |
| [legacy/](legacy/) | Imported Translumo source (Apache 2.0) — provides OCR, translators, screen capture, processing loop |

Each `src/RealTrans.*` project has its own README with details.

## Target platform

- **OS**: Windows 10 build 19041+ / Windows 11
- **Framework**: .NET 8 (`net8.0-windows10.0.19041.0`)
- **UI**: WPF host + WebView2 (Chromium) for the inner UI, served from `RealTrans.Shell/wwwroot`
- **Runtime**: `win-x64`, self-contained

## End-to-end flow

```
USER clicks "Start translating" (or presses ~ hotkey)
   │
   ▼
[wwwroot/app.jsx] handleStartSelection
   │  RealTransBridge.send("selection:open")
   ▼
[ShellWindow.xaml.cs] OnSelectionOpen
   │  Hide(); take screenshot; show SelectionAreaWindow
   ▼
[SelectionAreaWindow.cs] user drags a rect
   │  Committed event → WebMessageBus.Publish(SelectionCommittedMessage)
   ▼
[wwwroot/app.jsx] on("selection:committed")
   │  RealTransBridge.send("session:start", { regions: [...] })
   ▼
[SessionManager.cs] OnSessionStart → StartSession
   │  OcrLanguageProbe.Check(...) — abort early if OCR language pack missing
   │  Instantiate TranslationProcessingService, set CaptureArea + StabilityCheck
   │  TranslationSession.Start() → processingService.StartProcessing()
   ▼
[Translumo.Processing] capture → OCR → translate loop (~120 ms iter)
   │  WindowsOCREngine.GetTextLines(screenshot)
   │  GoogleTranslator.TranslateTextAsync(text)
   │  → WebTranslationResultSink.SendRegionResult(...)
   ▼
[WebTranslationResultSink] publishes TranslationResultMessage + OverlayUpdateMessage
   │
   ├─→ [wwwroot/app.jsx] feed update (control-panel right pane)
   │
   └─→ [OverlayManager.cs] creates / positions a ReplaceOverlayWindow over the
       captured region
```

Errors from the legacy pipeline (`IChatTextMediator.SendText`) are surfaced via
[`WebTranslationResultSink`](src/RealTrans.Core/Bridge/WebTranslationResultSink.cs)
as `ErrorMessage` / `StatusMessage` IPC envelopes and shown as muted rows in the
feed — so the user always sees what's happening, never silent failure.

## Configuration defaults

Set in [`App.xaml.cs:ConfigureServices`](src/RealTrans.Shell/App.xaml.cs):

- Source language: **Japanese**
- Target language: **English**
- OCR engine: **WindowsOCR only** (built-in, no models to bundle)
- Translator: **Google** (no API key required)

Persisted settings in `%APPDATA%/RealTrans/settings` (encrypted XML, written by
the legacy `ConfigurationStorage`) override these on subsequent runs.

## Build

```powershell
dotnet build backend/RealTrans.sln
```

Run the app:

```powershell
dotnet run --project backend/src/RealTrans.Shell/RealTrans.Shell.csproj
```

## First-run requirements

For Japanese OCR you need the Windows OCR language pack:

> Settings → Time & Language → Language & region → Add a language → Japanese
> → Optional language features → enable **"Optical character recognition"**.

If the pack is missing, `OcrLanguageProbe` fails the session at `Start translating`
and the feed shows an `[ocr-language-unavailable]` row with the install
instructions.

## Hotkeys

| Combo | Action |
|---|---|
| `Alt+Q` | Open command palette |
| `~` (Oem3) | Toggle selection / overlay |
| `Esc` | Dismiss topmost surface |

Registered via Win32 `RegisterHotKey` in
[`RealTrans.Core/HotKeys/RealTransHotKeyManager.cs`](src/RealTrans.Core/HotKeys/RealTransHotKeyManager.cs).

## License

RealTrans-specific code: project default (see repo root).
`backend/legacy/` is the Translumo source under **Apache 2.0** — preserve the
[`legacy/LICENSE`](legacy/LICENSE) and attribution if you redistribute.

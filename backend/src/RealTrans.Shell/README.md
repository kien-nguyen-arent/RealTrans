# RealTrans.Shell

WPF host process. Owns the main window, the WebView2 control that renders the
React UI from [`wwwroot/`](wwwroot/), the global DI container, and the
selection-region overlay window.

## Entry points

| File | Role |
|---|---|
| [App.xaml](App.xaml) + [App.xaml.cs](App.xaml.cs) | WPF `Application`. Builds DI, loads persisted config, registers hotkeys, shows the shell window. |
| [ShellWindow.xaml](ShellWindow.xaml) + [ShellWindow.xaml.cs](ShellWindow.xaml.cs) | Single-window WPF shell containing only a WebView2 control mapped to `https://realtrans.local/RealTrans.html`. |
| [SelectionAreaWindow.cs](SelectionAreaWindow.cs) | Full-screen transparent overlay for the user to drag a translation region. Multi-monitor + per-monitor DPI aware. |
| [Configuration/](Configuration/) | Wraps the legacy `ConfigurationStorage` to persist settings to `%APPDATA%/RealTrans/settings`. |

## WebView2 hosting model

The React UI is served from disk via WebView2's virtual-host mapping:

```csharp
WebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
    "realtrans.local", wwwroot, CoreWebView2HostResourceAccessKind.Allow);
WebView.CoreWebView2.Navigate("https://realtrans.local/RealTrans.html");
```

The mapping makes `wwwroot/` look like a same-origin website so Babel's
in-browser JSX compilation (`<script type="text/babel">`) can `XHR` sibling
files — which `file://` blocks.

## IPC: JS ↔ C#

Bridged through [`RealTrans.Core/Bridge/WebMessageBus.cs`](../RealTrans.Core/Bridge/WebMessageBus.cs).
Envelopes are declared in [`RealTrans.Core/Bridge/IpcMessage.cs`](../RealTrans.Core/Bridge/IpcMessage.cs).

### Inbound (JS → C#) — `RealTransBridge.send(type, payload)`

| Type | Payload | Handler |
|---|---|---|
| `app:ready` | — | `WebMessageBus.AppReady` |
| `selection:open` | — | `ShellWindow.OnSelectionOpen` |
| `session:start` | `{ scenarioId, renderMode, regions: [{id,x,y,w,h}] }` | `SessionManager.OnSessionStart` |
| `session:stop` | `{ scenarioId }` | `SessionManager.OnSessionStop` |
| `region:detect` | `{ scenarioId, screenRect }` | `SessionManager.OnRegionDetect` |
| `settings:set` | `{ translateFromLang?, translateToLang?, translator?, ocrEngines? }` | `SessionManager.OnSettingsSet` — applied live; wired to the ControlPanel **and** the Settings modal |
| `region:pin`, `region:unpin`, `settings:get`, `hotkey:reassign` | varies | declared on the bus, **no subscriber yet** (reserved) |

### Outbound (C# → JS) — `WebMessageBus.Publish(msg)`

| Type | Fields | Sender |
|---|---|---|
| `state:init` | `{ settings, pinnedRegions, activeScenario, renderMode }` | App startup |
| `hotkey:fired` | `{ action }` | `ShellWindow.SendHotkeyFired` |
| `selection:committed` | `{ rect: {x,y,w,h} }` | `SelectionAreaWindow.Committed` |
| `selection:cancelled` | — | `SelectionAreaWindow.SelectionCancelled` / unexpected close |
| `translation:started` | `{ regionId }` | `SessionManager.StartSession` |
| `translation:result` | `{ regionId, sourceText, translatedText, elapsedMs, renderMode }` | `WebTranslationResultSink.SendRegionResult` |
| `translation:cleared` | `{ regionId }` | `SubtitleHoldTimer.HoldExpired` |
| `overlay:update` | `{ regionId, rect, renderMode, translatedText, sequenceId }` | `WebTranslationResultSink` → `OverlayManager` |
| `regions:detected` | `{ scenarioId, regions: [RegionDto] }` | `SessionManager.OnRegionDetect` |
| `status` | `{ level, text }` | `WebTranslationResultSink.SendText` (info / warn — Translation started, etc.) |
| `error` | `{ code, message }` | `WebTranslationResultSink.SendText(_, false)` + `SessionManager` exception paths |

C# serializes outbound messages with `JsonNamingPolicy.CamelCase`, so a C#
record property `RegionId` becomes `regionId` in JS.

## SelectionAreaWindow

A full-screen overlay launched on `selection:open`. Before showing it,
`ShellWindow.OnSelectionOpen` hides the shell and waits 200 ms so the compositor
removes the shell window from the screen — then takes a GDI screenshot via
`Graphics.CopyFromScreen` and uses it as the canvas background. This freezes
the desktop while the user drags, giving them a stable visual reference.

Visual layers (z-order, bottom up):

1. Frozen desktop screenshot (canvas background)
2. Dim layer (`Color.FromArgb(100, 0, 0, 0)`)
3. Crosshair guide lines + coord label — visible only when idle (no drag)
4. Selection rectangle + dimension label — visible only during drag
5. HUD pill (top-center) — dynamic text: idle copy when not dragging, live
   "W × H px · Release to commit · Esc to cancel" while dragging

DPI handling: reads system DPI in the constructor (via Win32 `GetDeviceCaps`)
so the WPF DIU bounds are set correctly at window creation, then refines per-
monitor DPI in `OnSourceInitialized` (via `PresentationSource.CompositionTarget.TransformToDevice`).
On commit, WPF DIUs are converted to physical pixels using those DPI factors
and offset by the virtual-screen origin (`SM_XVIRTUALSCREEN` /
`SM_YVIRTUALSCREEN`), so the emitted `RectDto` is absolute physical-pixel
screen coordinates that the OCR pipeline can directly screenshot.

`ForceForeground()` bypasses Windows' `ForegroundLockTimeout` protection by
briefly attaching to the foreground thread's input queue, so the overlay
reliably receives mouse + keyboard input after `ShellWindow.Hide()`.

## DI services registered

See [`App.xaml.cs:ConfigureServices`](App.xaml.cs). Defaults applied at DI
build time, then overwritten by `ConfigurationStorage.LoadConfiguration` in
`OnStartup` if persisted settings exist.

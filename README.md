# RealTrans

In-place screen-translation overlay for Windows. A global hotkey opens a command
palette; the user selects a region of the screen and RealTrans overlays a
real-time translation on top of the original content.

## Repository layout

| Path | What |
|---|---|
| `backend/src/RealTrans.Shell` | WPF app — hosts the UI in a WebView2 and wires the IPC bridge. Entry point. |
| `backend/src/RealTrans.Core` | Capture, session orchestration, stabilization, `WebMessageBus`, configuration. |
| `backend/src/RealTrans.Overlay` | Transparent overlay windows (replace / ghost render modes). |
| `backend/legacy` | Original Translumo sources (OCR / translation / TTS pipeline) reused by the backend. |
| `prototype/design` | Design reference (React/HTML). The shipped UI lives in `RealTrans.Shell/wwwroot`. |
| `backend/RealTrans.sln` | Solution file. |

## Prerequisites

- **.NET 8 SDK** (`dotnet --version` ≥ 8.0). The app targets `net8.0-windows10.0.19041.0`, `win-x64`.
- **WebView2 Runtime** (Evergreen) — preinstalled on current Windows 10/11. Otherwise install from
  <https://developer.microsoft.com/microsoft-edge/webview2/>.
- Windows (the app is WPF + Win32 screen capture).

## Build

```powershell
# from the repo root
dotnet build backend/RealTrans.sln -c Debug
```

Or just the app project (pulls in the whole graph):

```powershell
dotnet build backend/src/RealTrans.Shell/RealTrans.Shell.csproj -c Debug
```

## Run (development)

```powershell
dotnet run --project backend/src/RealTrans.Shell/RealTrans.Shell.csproj
```

Or run the built apphost directly:

```
backend/src/RealTrans.Shell/bin/Debug/net8.0-windows10.0.19041.0/win-x64/RealTrans.Shell.exe
```

## Publish (self-contained, distributable)

```powershell
dotnet publish backend/src/RealTrans.Shell/RealTrans.Shell.csproj `
  -c Release -r win-x64 --self-contained true `
  -o backend/publish/RealTrans
```

Resulting app: **`backend/publish/RealTrans/RealTrans.Shell.exe`**. The output is a
self-contained folder (~280+ DLLs + native libs + `wwwroot/`); no .NET runtime needs
to be installed on the target machine.

> ⚠️ **The published `.exe` will not launch on its own.** It is an *apphost launcher*
> that loads `RealTrans.Shell.dll` and the runtime DLLs next to it. Because `*.dll`
> is git-ignored (see `.gitignore`), the committed `backend/publish/` folder does
> **not** contain those binaries — you must run the `dotnet publish` command above
> locally to regenerate a runnable folder. Never commit the DLLs.

## Where things live at runtime

- **Settings** (persisted, encrypted XML): `%AppData%\RealTrans\settings`
- **Logs** (Serilog, daily rolling): `Logs\log.txt` next to the executable

## Default hotkeys

| Combo | Action |
|---|---|
| `Alt + Q` | Open command palette |
| `` ~ `` | Toggle translation / start region selection |
| `Esc` | Dismiss the topmost surface |

Hotkeys are rebindable in **Settings → Hotkeys**.

# RealTrans frontend (`wwwroot/`)

The React UI hosted inside the WPF `ShellWindow`'s WebView2 control. Served
from disk by WebView2's virtual-host mapping at `https://realtrans.local/`.

There is no build step — JSX is compiled in-browser by `@babel/standalone`.
This keeps iteration fast and lets the C# build pipeline stay simple, at the
cost of ~70 KB of Babel runtime per cold start.

## File map

| File | Purpose |
|---|---|
| [RealTrans.html](RealTrans.html) | Entry — pulls React, Babel, fonts, then loads every `*.jsx` as `text/babel`. |
| [app.css](app.css) | All design tokens — colors, fonts, motion, glass surfaces, `kbd` chip. Match the values in `prototype/design/app.css`. |
| [bridge.js](bridge.js) | `RealTransBridge.send / on / ready` — thin wrapper over `window.chrome.webview`. Falls back to console-log no-ops outside WebView2 so you can open the file in a plain browser for visual work. |
| [app.jsx](app.jsx) | App root. Two-column layout. State machine (`selecting`, `overlayActive`, modal open flags). All `RealTransBridge` listeners + senders live here. |
| [control-panel.jsx](control-panel.jsx) | `ControlPanel` (left sidebar: mode selector, overlay style, **Start translating** CTA, quick links) + `TranslationFeed` (right pane: live feed of translations + status / error rows). |
| [palette.jsx](palette.jsx) | Command palette (Alt+Q). |
| [settings.jsx](settings.jsx) | Settings modal with tabs (General, Pinned regions, Modes, Appearance, Hotkeys, Advanced). Currently visual-only — `onChange` handlers don't send to C# yet. |
| [onboarding.jsx](onboarding.jsx) | First-run flow. |
| [notes.jsx](notes.jsx) | Saved-translations log. |
| [selection.jsx](selection.jsx) | Prototype's HTML selection overlay. **Not used in production** — the production selection lives in [`../SelectionAreaWindow.cs`](../SelectionAreaWindow.cs). Kept here for visual reference. |
| [overlays.jsx](overlays.jsx) | Prototype's overlay render modes. **Not used in production** — production overlays live in [`../../RealTrans.Overlay`](../../RealTrans.Overlay). Reference only. |
| [ui.jsx](ui.jsx) | Shared atoms: `Icon`, `Wordmark`, `Pill`, `ThinkingDots`, `kbd`. |
| [data.jsx](data.jsx) | Demo command list shape (for palette). |
| `scenarios.jsx`, `desktop.jsx`, `demo-controller.jsx`, `tweaks-panel.jsx` | Demo-only scaffolding from the prototype. Not loaded by `RealTrans.html`. |

## State machine

Lives in [app.jsx](app.jsx) — booleans, not an enum:

| Flag | When true |
|---|---|
| `selecting` | The C# selection window is open (between `selection:open` send and `selection:committed`/`selection:cancelled`/timeout). |
| `overlayActive` | A translation session is running (between `session:start` send and `session:stop`). |
| `paletteOpen` | Command palette modal open. |
| `settingsOpen`, `onboardingOpen`, `notesOpen` | Other modals. |

The Start/Stop CTA in `control-panel.jsx` switches on these flags:

- `overlayActive` → "Stop translating"
- `selecting && !overlayActive` → disabled "Selecting region…" with thinking dots
- otherwise → "Start translating"

## Bridge contract

See [`../README.md`](../README.md#ipc-js--c) for the full envelope list.
Quick summary:

```js
// Outbound (JS → C#)
RealTransBridge.send("selection:open");
RealTransBridge.send("session:start", { scenarioId, renderMode, regions: [...] });
RealTransBridge.send("session:stop",  { scenarioId });

// Inbound (C# → JS)
RealTransBridge.on("selection:committed", ({ rect }) => { /* { x, y, w, h } in physical pixels */ });
RealTransBridge.on("selection:cancelled", () => { /* user pressed Esc */ });
RealTransBridge.on("translation:result",  ({ regionId, sourceText, translatedText, elapsedMs, renderMode }) => { });
RealTransBridge.on("hotkey:fired",        ({ action }) => { /* "openPalette" | "toggleOverlay" */ });
RealTransBridge.on("status",              ({ level, text }) => { /* pipeline lifecycle, e.g. "Translation started" */ });
RealTransBridge.on("error",               ({ code, message }) => { /* surfaced into the feed as an error row */ });
```

## The feed row variants

`<FeedItem>` in `control-panel.jsx` switches on `item.kind`:

- **`"translation"`** (default) — source / arrow / translated / meta layout. The
  typical row.
- **`"status"`** — single muted monospace line (e.g. *"Translation started"*).
- **`"error"`** — `[code]` in rose, full message body underneath. Used for OCR
  language-pack missing, translator failure, capture failure, etc.

The error variant has visual weight because these messages are usually
actionable (install OCR pack, switch translator, check VPN).

## Editing tips

- The page is served at `https://realtrans.local/` — Chromium devtools work in
  WebView2 (right-click → Inspect when developer mode is enabled in the WebView2
  options, or set `WebView2.CoreWebView2.Settings.AreDevToolsEnabled = true` in
  `ShellWindow.xaml.cs`).
- `app.css` defines `--rt-*` design tokens. Always use the variables rather
  than hard-coding hex / opacity — the prototype's contrast/motion will silently
  regress if you don't.
- The Babel `text/babel` script tags compile JSX at page load. A syntax error
  shows in the devtools console, not in the C# log.

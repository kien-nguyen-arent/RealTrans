# Handoff: RealTrans — In-place Translation Overlay

## Overview

**RealTrans** is a system-level in-place translation tool. The user invokes it
with a global hotkey (`⌃⌥Space`), selects a region of their screen (or a window,
or "everything visible"), and RealTrans overlays a real-time translation on top
of the original content — replacing, ghosting, paralleling, or carding the text
depending on the chosen render mode.

The product is intended to translate anything the user sees, regardless of
source app: web pages, video subtitles (anime / streaming), game UI, manga
images, video-meeting captions, PDFs, etc.

---

## ⚠️ About the design files

Everything in `design/` is a **design reference** — HTML/React prototypes that
demonstrate the intended **look, copy, interaction model, and motion** of
RealTrans. They are **not the application to ship**.

The prototype runs the RealTrans UI on top of a *simulated* target surface
(fake anime player, fake browser page, fake game HUD, etc.) so the design can
be evaluated end-to-end inside a single HTML file. In production, those
"scenarios" do not exist — the target surface is whatever real app the user
happens to be looking at.

**Your job is to recreate the RealTrans UI and its behavior as a real
desktop application in the target codebase / framework — NOT to embed the
HTML.** See "Target platform" below.

## Fidelity

**High-fidelity.** Colors, typography, spacing, motion, copy, and interaction
flows are final. Match them pixel-for-pixel using the platform's native UI
toolkit (or a styled web layer if Electron). Treat the HTML files as
ground truth for visual + interaction spec.

---

## Target platform (decide before starting)

RealTrans is a screen-overlay app. The implementation differs significantly
by platform. **Pick one before you start writing code, and tell the user
which one you picked + why.**

| Platform | Stack | Strengths | Watch-outs |
|---|---|---|---|
| **macOS native** | Swift / SwiftUI, ScreenCaptureKit (capture), Vision (OCR), NSPanel `.nonactivating` + `.floating` (overlay), Carbon Hotkey API or `MASShortcut` (global hotkey) | Best perf, free on-device OCR, cleanest overlay model | Requires Screen Recording + Accessibility permissions |
| **Windows native** | C# + WinUI 3 or WPF, Graphics Capture API, `Windows.Media.Ocr`, layered transparent topmost window, `RegisterHotKey` | Native OCR included, good capture API | Per-monitor DPI, click-through windows are fiddly |
| **Electron (cross-platform)** | Electron + React + `desktopCapturer` / `getDisplayMedia`, Tesseract.js or cloud OCR (Google / DeepL / GPT-4o vision), `globalShortcut`, transparent BrowserWindow | Fastest path, one codebase, can reuse the prototype's React directly | Heavier on RAM/CPU; OCR latency depends on provider |
| **Browser extension** | MV3 Chrome/Edge extension, `chrome.scripting`, DOM mutation for replace mode | Easiest of all; no permissions theater | Only works inside browser tabs — anime apps, games, video conferencing, native PDFs are out of scope |

**Translation backend** — independent of the above. Sensible defaults:
- DeepL API for JA/KO/ZH/EU pairs (highest quality)
- GPT-4o or Claude for context-aware passages
- Google Translate as fallback

**OCR backend** — for image/video sources (no DOM):
- macOS: Vision framework (free, on-device)
- Windows: `Windows.Media.Ocr` (free, on-device)
- Cross-platform: Tesseract.js (free, slower), or paid (Google Cloud Vision, GPT-4o vision)

For browser pages, **prefer DOM text extraction over OCR** — pull text nodes,
translate, mutate in place. Falls back to OCR for canvas/video/PDF content.

---

## Visual identity / design tokens

All defined in `design/app.css`. Lift these exact values.

### Color

| Token | Value | Use |
|---|---|---|
| `--rt-bg` | `#0a0a0c` | Deepest background |
| `--rt-bg-2` | `#111114` | Surface 2 |
| `--rt-bg-3` | `#18181c` | Surface 3 |
| `--rt-glass` | `rgba(20, 21, 26, 0.72)` | Glass surface (with 28px blur + 180% saturate) |
| `--rt-glass-hi` | `rgba(28, 30, 36, 0.86)` | Strong glass (40px blur + 200% saturate) |
| `--rt-line` | `rgba(255,255,255,0.07)` | Hairline divider |
| `--rt-line-2` | `rgba(255,255,255,0.12)` | Hairline divider, stronger |
| `--rt-line-hi` | `rgba(255,255,255,0.22)` | Focus/active border |
| `--rt-fg` | `#f4f4f5` | Primary text |
| `--rt-fg-2` | `rgba(244,244,245,0.72)` | Secondary text |
| `--rt-fg-3` | `rgba(244,244,245,0.48)` | Tertiary / metadata |
| `--rt-fg-4` | `rgba(244,244,245,0.32)` | Disabled / hint |
| `--rt-accent` | `#8b7cff` | RealTrans brand violet |
| `--rt-accent-bright` | `#a899ff` | Hover / focused accent |
| `--rt-accent-deep` | `#5d4ce0` | Pressed / accent shadow |
| `--rt-accent-glow` | `rgba(139,124,255,0.32)` | Glow halo (boxshadow) |
| `--rt-cyan` | `#5eead4` | Live / streaming indicator |
| `--rt-amber` | `#f5b75e` | Caution / OCR uncertainty |
| `--rt-rose` | `#f471a8` | Manga accent |
| `--rt-mint` | `#6ee7a8` | Success / committed |

### Type
- Sans: **Geist** (`--rt-font`), weights 300/400/500/600/700
- Mono: **Geist Mono** (`--rt-mono`), weights 400/500/600 — used for hotkeys, timing, ms numbers, language codes
- JP: **Noto Sans JP** + **Noto Serif JP** — for source text in scenarios

### Radius
- `--rt-radius-sm` 8px, `--rt-radius` 12px, `--rt-radius-lg` 18px

### Shadow
See `--rt-shadow-1`, `--rt-shadow-2`, `--rt-shadow-pop` in `app.css`. Heavy use of layered hairline-inset + drop shadow.

### Motion
- `--rt-ease` `cubic-bezier(0.22, 1, 0.36, 1)` (default ease)
- `--rt-ease-2` `cubic-bezier(0.16, 1, 0.3, 1)` (pop-in)
- Keyframes: `rt-fade-in`, `rt-pop-in`, `rt-glow-pulse`, `rt-scan`, `rt-blink`, `rt-shimmer` (see `app.css`)
- Typical durations: 120–300ms. Palette pop-in 300ms `ease-2`. OCR detection shimmer 1.6s linear infinite.

### Glass / blur
Two reusable surface mixins (see `app.css` `.glass` and `.glass-strong`).
On platforms without web `backdrop-filter`, use the OS-native vibrancy
(macOS `NSVisualEffectView` with `.hudWindow` / `.popover`; Windows
`SystemBackdrop = Acrylic`).

---

## Screens / surfaces

Each is implemented in the prototype as a React component in `design/`.

### 1. Command Palette (`palette.jsx`)
- **Trigger**: global hotkey `⌃⌥Space` (or `Ctrl+Alt+Space` on Win)
- **Position**: top-center, ~640px wide, ~480px tall
- **Look**: `glass-strong` surface, 12px radius, 16px padding, pop-in animation
- **Sections**: search input at top → command list grouped by section (e.g. *Translate*, *Recent*, *Settings*). Each row has a leading icon, a title, an optional secondary string, and a trailing kbd chip.
- **Behavior**:
  - Fuzzy match against command title + keywords
  - ↑/↓ to navigate, ↵ to commit, `Esc` to dismiss
  - Selecting "Translate selection" / "Translate window" → close palette, open Selection overlay
  - Selecting "Open Settings" → close palette, open Settings sheet
- **States**: empty (default), filtering, no-results

### 2. Selection Overlay (`selection.jsx`)
- **Purpose**: user drags a rect to mark the region to translate (or click-targets a window / element)
- **Look**: full-screen scrim `rgba(0,0,0,0.18)` + crosshair cursor. Live rect is a `1.5px solid var(--rt-accent)` with a `var(--rt-accent-glow)` halo and a small floating chip showing W×H + "Translate ↵ / Cancel Esc".
- **Behavior**: mousedown-drag-release commits. `Esc` cancels. While idle (no drag yet), hovering a window highlights its bounds (snap-to-window).
- **Output**: commits the rect → triggers OCR → renders the active OverlayLayer

### 3. Overlay Layer / Render modes (`overlays.jsx`)
Four render styles. Tweak: `renderMode`.

| Mode | Behavior | When to use |
|---|---|---|
| **Replace** | Source text is hidden; translation rendered in its place, matching position, color, line breaks. | DOM content (HTML pages) where you can mutate text nodes. |
| **Ghost** | Translation rendered with `mix-blend-mode: difference` directly over source, slightly larger box. Source remains faintly visible. | Captured-image content (video frames, screenshots) where positioning may drift. |
| **Parallel** | Translation appears as a second line directly *below* the source, with a hairline separator. | Subtitles, manga panels, dual-language reading. |
| **Card** | Translation appears in a floating glass card anchored to top-right of the selected region with a connector line. | Dense or visually noisy sources where in-line overlay would be illegible. |

All four:
- Fade in over 200ms with a subtle 4px upward translate
- Show an OCR "scan" sweep before the translation lands
- Have a small chip in the top-right of the translated zone: `JA → EN · 282ms · Tap to revert`
- Persist until the user dismisses or the source changes substantially

### 4. Translated Banner (`app.jsx` → `<TranslatedBanner>`)
Top-center pill that appears whenever an overlay is active. Shows: live dot (cyan, pulsing), "Translating · {mode}", "{lang} → {lang} · {latency}ms", close X.

### 5. Hotkey Hint (`app.jsx` → `<HotkeyHint>`)
Bottom-right pill, idle state only. Says "RealTrans · idle · ⌃⌥Space to translate". Soft `rt-glow-pulse` animation. Clicking opens the palette.

### 6. Onboarding (`onboarding.jsx`)
3-step intro. ~720×460 modal, glass-strong. Steps: (1) hotkey demo, (2) pick language pair, (3) grant Screen Recording / Accessibility permission. Each step has illustration + heading + body + primary button. Pagination dots bottom-center.

### 7. Settings (`settings.jsx`)
Sheet, ~720×560. Tabs along the left rail (General, Languages, Render, Hotkeys, Privacy, About). Right pane shows the active tab's form. Use platform-native form controls or match the prototype's chrome.

### 8. Notes (`notes.jsx`)
Lightweight saved-translations log. List of past translations (timestamp, source snippet, translated snippet, source app, action menu). Bottom: search + filter chips.

### 9. Demo controller (`demo-controller.jsx`)
**This is a demo-only surface — do not ship it.** It exists in the prototype so reviewers can swap between fake scenarios and force overlay state. The shipping app has no need for it.

---

## Interaction flows

```
IDLE
  └─ HotkeyHint visible (bottom-right)
  └─ ⌃⌥Space pressed → open Palette

PALETTE
  └─ ↑/↓/type to filter
  └─ ↵ on "Translate selection" → close palette, enter SELECTION
  └─ ↵ on "Translate window" → close palette, OCR active window directly, go to OVERLAY
  └─ ↵ on "Open settings" → close palette, open Settings
  └─ Esc → close palette, return to IDLE

SELECTION
  └─ Drag rect → release commits rect, go to OCR
  └─ Hover window → snap-highlight window bounds (click commits)
  └─ Esc → return to IDLE

OCR (transient, 100–500ms)
  └─ Scan sweep animation across the selected rect
  └─ On success → OVERLAY
  └─ On failure → toast: "Couldn't read this region", return to IDLE

OVERLAY
  └─ TranslatedBanner visible (top-center)
  └─ Active render mode painted over source
  └─ Click translated text → toggle revert/show-source
  └─ Esc OR banner X → fade out overlay, return to IDLE
  └─ Source changes (video frame, page navigation) → re-OCR, re-render
```

## Global keyboard

| Combo | Action |
|---|---|
| `⌃⌥Space` (mac) / `Ctrl+Alt+Space` (win) | Open palette |
| `⌃⌥T` | Translate active window directly (skip palette) |
| `⌃⌥S` | Open selection overlay directly |
| `Esc` | Dismiss topmost surface in order: Notes → Settings → Onboarding → Palette → Selection → Overlay |
| `↑` / `↓` | Navigate palette list |
| `↵` | Commit palette selection / Commit selection rect |

Hotkeys should be **rebindable** in Settings → Hotkeys.

---

## State (production app)

Roughly:

```
appState:
  mode: 'idle' | 'palette' | 'selecting' | 'ocr' | 'overlay' | 'settings' | 'notes' | 'onboarding'
  renderMode: 'replace' | 'ghost' | 'parallel' | 'card'
  sourceLang: ISO-639  (auto-detected by default)
  targetLang: ISO-639  (user-chosen)
  selection: Rect | { windowId } | null
  ocrResult: { blocks: [{ bbox, text, conf }] } | null
  translation: { blocks: [{ bbox, text, srcText, latencyMs }] } | null
  history: TranslationRecord[]   // for the Notes view, persisted
  hotkeys: { palette: string, translateWindow: string, selection: string }
  prefs: { autoDetect, glossary, providerOrder, ... }
```

Persist `history`, `hotkeys`, `prefs` to disk (SQLite, JSON, or platform-native settings store).

---

## Files in this handoff

| Path | Purpose |
|---|---|
| `design/RealTrans.html` | Prototype entry — open in a browser to see everything |
| `design/app.css` | All design tokens — colors, type, motion, glass, kbd chip |
| `design/app.jsx` | App root, state orchestration, keyboard wiring |
| `design/palette.jsx` | Command palette |
| `design/selection.jsx` | Region-selection overlay |
| `design/overlays.jsx` | The four render modes (replace / ghost / parallel / card) |
| `design/onboarding.jsx` | First-run flow |
| `design/settings.jsx` | Settings sheet |
| `design/notes.jsx` | Saved translations log |
| `design/scenarios.jsx` | **Demo only — fake target surfaces. Discard.** |
| `design/desktop.jsx` | **Demo only — empty stage frame. Discard.** |
| `design/demo-controller.jsx` | **Demo only. Discard.** |
| `design/data.jsx` | Demo content (Japanese sample text, fake commands). Cherry-pick the command list shape for Palette implementation. |
| `design/ui.jsx` | Shared atoms: `Icon`, `Wordmark`, `kbd`. Reimplement in target platform. |
| `design/tweaks-panel.jsx` | Demo-only knobs UI. Discard. |

## What to keep, what to throw away

**Keep / port** — these define the real product:
- `palette.jsx`, `selection.jsx`, `overlays.jsx`, `onboarding.jsx`,
  `settings.jsx`, `notes.jsx`
- `app.css` (every token)
- The keyboard wiring and state machine from `app.jsx`
- The `Icon` set in `ui.jsx`

**Throw away** — prototype scaffolding:
- `desktop.jsx`, `demo-controller.jsx`, `scenarios.jsx`, `tweaks-panel.jsx`
- The scenario state in `app.jsx` (`scenarioId`, `SCENARIOS`, the `<Scene*>` components)
- The clock, the simulated wallpaper, anything that pretends to *be* the OS

---

## Assets

- **Fonts**: Geist + Geist Mono (free, OFL, from Vercel) — bundle or load from Google Fonts. Noto Sans/Serif JP only needed if you ship the prototype itself; production app uses whatever font the target surface already uses for source text.
- **Icons**: simple stroked SVGs defined inline in `ui.jsx`. Reimplement as the target platform's native icon set (SF Symbols on mac, Segoe Fluent on Windows, Lucide on web).
- **Logo**: simple wordmark in `ui.jsx` (`<Wordmark>`). The "RT" mark uses `var(--rt-accent)`.

---

## Open questions for the developer

1. **Which platform** (see "Target platform" above)? Pick before starting.
2. **Translation provider** — DeepL, Google, GPT-4o, Claude? Probably needs a pluggable abstraction so users can BYO API key.
3. **OCR strategy** — DOM-first for browser content, OCR-fallback for everything else?
4. **Privacy posture** — does any of the OCR / translation happen off-device? Surface this in Settings → Privacy and in Onboarding step 3 so the user grants permissions knowingly.
5. **Persistence backend** — SQLite for history, plus platform-native prefs store?
6. **Auto-update** — Sparkle (mac) / Squirrel (Win) / built-in (Electron auto-updater)?

---

## Suggested initial Claude Code prompt

> I'm building **RealTrans**, an in-place screen-translation overlay app. The
> `design_handoff_realtrans/` folder contains design references (HTML/React
> prototypes) — read the README and `design/` files first; do **not** try to
> ship the HTML.
>
> Please:
> 1. Read `design_handoff_realtrans/README.md` end-to-end.
> 2. Recommend a target platform (macOS native, Windows native, Electron, or
>    browser extension) given that I want [STATE YOUR PRIORITIES — e.g. "macOS
>    only, lowest latency, on-device OCR"]. Explain the tradeoff before
>    starting.
> 3. Scaffold the project in that platform's idiomatic structure.
> 4. Implement the surfaces in this order: global hotkey → Palette → Selection
>    overlay → OCR pipeline → Overlay Layer (start with Replace mode) →
>    TranslatedBanner → Onboarding → Settings → Notes. Add Ghost / Parallel /
>    Card render modes last.
> 5. Match the visual tokens in `design/app.css` exactly. Use the platform's
>    native vibrancy/blur surface for glass — do not fake it with semi-opaque
>    colors.
> 6. Make hotkeys, language pair, render mode, and OCR/translation provider
>    user-configurable in Settings.
> 7. Open the prototype in a browser (`design/RealTrans.html`) while you work
>    so you can compare your build to the reference.
>
> Ask me clarifying questions before you start coding.

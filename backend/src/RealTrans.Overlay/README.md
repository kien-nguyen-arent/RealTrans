# RealTrans.Overlay

Per-region translation-overlay windows. One overlay window per active region;
the window sits on top of the captured area and renders the translated text in
the chosen render mode (Replace, Ghost, Parallel, Card).

## Folder map

| File | Purpose |
|---|---|
| [OverlayManager.cs](OverlayManager.cs) | Creates / positions / destroys overlay windows. Listens for `overlay:update` and `translation:cleared` IPC messages. |
| [OverlayWindowBase.cs](OverlayWindowBase.cs) | Base class. Always-on-top, transparent, no taskbar entry, no title bar, click-through by default. |
| [Win32OverlayHelper.cs](Win32OverlayHelper.cs) | Applies `WS_EX_TRANSPARENT` (click-through) and `WS_EX_NOACTIVATE` (no focus steal) via Win32. |
| [Modes/ReplaceOverlayWindow.cs](Modes/ReplaceOverlayWindow.cs) | Replace mode — translated text rendered in place of the source. |
| [Modes/GhostOverlayWindow.cs](Modes/GhostOverlayWindow.cs) | Ghost mode — translated text with `mix-blend-mode`-like difference effect over the source. |

The Parallel and Card render modes from the prototype design are not yet
implemented; the manager falls back to Replace.

## Lifecycle

```
[WebTranslationResultSink] publishes OverlayUpdateMessage
   │
   ▼
[OverlayManager.OnOutboundMessage] dispatches to UI thread
   │
   ▼
ApplyUpdate:
   - Drop late-arriving updates by SequenceId
   - PixelsToWpf via DpiHelper (physical-px Rect → WPF DIU Rect)
   - Create the right window subclass for the render mode (or reuse existing)
   - PositionAt(x, y, w, h)
   - UpdateTranslation(text, renderMode)
```

On `translation:cleared` (fired by `SubtitleHoldTimer` after ~600 ms of no
new results) the overlay window is closed and its sequence guard is removed.

## Click-through

`OverlayWindowBase.OnSourceInitialized` calls
[`Win32OverlayHelper.ApplyOverlayStyle(window, clickThrough: true)`](Win32OverlayHelper.cs)
which sets `WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_LAYERED`. The user's
mouse passes straight through the overlay to the underlying app — clicking on
the translated text doesn't steal focus from the video player / browser / game
underneath.

Card mode (when implemented) will need `clickThrough: false` so the user can
interact with the floating card (copy translation, expand history).

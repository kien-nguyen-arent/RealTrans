# Mode Roadmap

Only **Caption Mode** is built for MVP. All other modes are documented below for V2.

---

## Caption Mode (MVP — DONE)
- Covers: anime, VLC, streaming video, any hardcoded subtitle
- Region detection: fixed bottom 22% strip, center 84% width — no OpenCV
- Polling: 120ms with FrameDiffer + StabilizationEngine
- OCR: WinOCREngineWithPreprocess (primary) + optional Tesseract
- Overlay: Replace (semi-opaque cover) + Ghost (violet tint)

---

## Browser Mode (V2)
- Covers: foreign-language web articles, translation in browsers
- Region detection: OpenCV MSER text-block segmentation → paragraph rects
- Polling: 800ms (stable content, no rapid changes)
- Overlay: Replace + Parallel (side-by-side)
- Note: Large blocks of text may need chunked translation to avoid API limits

## Game Mode (V2)
- Covers: JRPG dialogue boxes, game UI menus, HUD text
- Region detection: OpenCV `findContours` → classify by screen position (bottom = dialogue, top-right = menu, top-left = HUD)
- Polling: 250ms
- Overlay: Replace (dialogue) + Card (HUD)
- IMPORTANT: Test anti-cheat compatibility before marketing this mode.
  Known-problematic anti-cheats: Vanguard (Valorant), Easy Anti-Cheat, BattlEye.
  Consider "safe compatibility mode" (BitBlt capture only, no DX desktop duplication) as an option.
  Do NOT claim "works with all games" until individually tested.

## Manga Mode (V2)
- Covers: manga reader apps, scanned manga images, webtoon pages
- Region detection: on-demand scan (NOT continuous polling)
  OpenCV `HoughCircles` + `approxPolyDP` → speech bubble contours
  Real-world caveats: broken bubbles, angled text, handwritten effects, overlapping panels, dirty scans.
  Treat detection results as "suggestions", not guaranteed detections.
  UI should show: "Found N regions — confirm before translating"
- Processing: `ProcessOnce()` per bubble; batch all results before sending
- Overlay: Replace (cover bubble background, render translation in bubble font)
- Font matching: detect bubble font style; use closest system font as approximation.
  Production-grade version would use AI font recognition.

## Meeting Mode (V2)
- Covers: video call captions (Zoom, Teams, Meet), live event transcriptions
- Region detection: same fixed-strip as Caption Mode (bottom 20%)
- Polling: 115ms (faster than Caption — caption strips change quickly)
- Speaker detection: left-side name label heuristic (detect colored text prefix before colon)
- Audio extension point: `AudioCaptureService` stub present for future Whisper/Azure Speech integration.
  For V1, caption-region OCR works without audio regardless.
- Overlay: Card (consolidated card showing last N speaker turns)

---

## Overlay Mode Roadmap

| Mode | MVP | V2 |
|------|-----|----|
| Replace | ✅ | ✅ |
| Ghost | ✅ | ✅ |
| Parallel | — | V2 |
| Card | — | V2 |

## Rendering Roadmap

| Feature | Status |
|---------|--------|
| Flat semi-opaque WPF overlay | ✅ MVP |
| Fade-in animation on text change | ✅ MVP |
| Font size matching source text | V2 |
| Background inpainting (true replacement) | V3 / Phase 3 — requires AI |
| DirectComposition/WinUI 3 rendering | V3 — if WPF transparency becomes a performance bottleneck |

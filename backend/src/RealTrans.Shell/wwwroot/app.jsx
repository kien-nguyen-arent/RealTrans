/* app.jsx — Production entry point.
   Two-column layout: ControlPanel (left) + TranslationFeed (right).
   All demo content (fake desktop, scenario windows) removed.
   Communicates with C# backend via RealTransBridge (bridge.js).
*/

const App = () => {
  const [scenarioId, setScenarioId]         = useState("anime");
  const [renderMode, setRenderMode]         = useState("inline");
  const [overlayActive, setOverlayActive]   = useState(false);
  const [paletteOpen, setPaletteOpen]       = useState(false);
  const [selecting, setSelecting]           = useState(false); // WPF selection window is open
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [notesOpen, setNotesOpen]           = useState(false);
  const [feed, setFeed]                     = useState([]);
  // Latest raw OCR text from the side channel. Refreshed every ~1s while a
  // session is running. Displayed in the Original half of Inline mode so the
  // user can verify OCR is reading SOMETHING even before a translation lands.
  const [latestPreview, setLatestPreview]   = useState(null);
  // Latest per-iteration OCR telemetry (iter, captureBytes, charCount, score,
  // engine). Shows a pulsing "alive" row in the Original half.
  const [latestTick, setLatestTick]         = useState(null);
  // Latest capture thumbnail (base64 PNG) — visual confirmation that capture
  // is targeting the right pixels.
  const [latestThumbnail, setLatestThumbnail] = useState(null);

  // Active translation settings — initialized to the C# defaults so the UI looks
  // sensible during the brief window before settings:state arrives from C#. The
  // C# snapshot (sent on app:ready) overwrites these to match whatever persisted
  // or default state the backend wound up with.
  const [sourceLang, setSourceLang]   = useState("English");
  const [targetLang, setTargetLang]   = useState("Vietnamese");
  const [translator, setTranslator]   = useState("Google");
  const [ocrEngines, setOcrEngines]   = useState({ WindowsOCR: true, Tesseract: false, EasyOCR: false });

  // Mirror the latest values into refs so the bridge handlers — registered once
  // in the useEffect([]) below and never re-registered — read current state instead
  // of stale first-render closures (the user can change scenario / render mode, or
  // toggle selection, before a selection commits).
  const scenarioIdRef = useRef(scenarioId);
  const renderModeRef = useRef(renderMode);
  const handleStartSelectionRef = useRef(null);
  scenarioIdRef.current = scenarioId;
  renderModeRef.current = renderMode;

  // ── Bridge ───────────────────────────────────────────────────────
  useEffect(() => {
    RealTransBridge.ready();

    RealTransBridge.on("state:init", (p) => {
      if (p.renderMode)     setRenderMode(p.renderMode);
      if (p.activeScenario) setScenarioId(p.activeScenario);
    });

    // C# snapshot of language pair / translator / OCR engines, sent on app:ready
    // and re-emitted after every settings:set. Brings the UI in sync with what
    // the backend actually has (including the guardrail-forced WindowsOCR if the
    // user disabled everything).
    RealTransBridge.on("settings:state", (p) => {
      if (p.sourceLang) setSourceLang(p.sourceLang);
      if (p.targetLang) setTargetLang(p.targetLang);
      if (p.translator) setTranslator(p.translator);
      if (p.ocrEngines) setOcrEngines(p.ocrEngines);
    });

    RealTransBridge.on("translation:result", (p) => {
      setFeed(prev => [...prev.slice(-49), { ...p, kind: "translation" }]);
    });

    // Backend lifecycle messages (Translation started/finished, etc.) — appear as
    // a muted status row so the user can see the pipeline reacting to their click
    // instead of staring at a frozen "Waiting for text…".
    RealTransBridge.on("status", (p) => {
      setFeed(prev => [...prev.slice(-49), {
        kind: "status",
        level: p.level || "info",
        text: p.text || "",
      }]);
    });

    // Raw OCR preview (throttled 1 Hz on the C# side). Stored as a single latest
    // value, not appended to the feed, so it doesn't pollute history. The Inline
    // layout's Original half renders this beneath any committed source-text rows.
    // Note: ocr:preview is the legacy envelope; ocr:tick (below) supersedes it
    // with full telemetry. Kept for back-compat in case anything still emits it.
    RealTransBridge.on("ocr:preview", (p) => {
      setLatestPreview({ text: p.text || "", at: Date.now() });
    });

    // Per-iteration OCR telemetry — fires on EVERY OCR call (throttled 2 Hz).
    // The iteration counter incrementing proves the legacy OCR loop is alive
    // even when text is empty. Char count = 0 + bytes > 0 = OCR reading but
    // returning nothing. Char count > 0 + score < 2.1 = OCR reading but
    // predictor rejecting. Char count > 0 + score >= 2.1 = translation imminent.
    RealTransBridge.on("ocr:tick", (p) => {
      setLatestTick({
        iteration:     p.iteration ?? 0,
        captureBytes:  p.captureBytes ?? 0,
        text:          p.text || "",
        charCount:     p.charCount ?? 0,
        validityScore: p.validityScore ?? 0,
        engineName:    p.engineName || "?",
        lastCapturePath: p.lastCapturePath || "",
        at:            Date.now(),
      });
    });

    // Live thumbnail (base64 PNG, ≤200 px wide). Throttled 0.5 Hz. Lets the
    // user visually confirm the captured region matches what they selected.
    RealTransBridge.on("capture:thumbnail", (p) => {
      setLatestThumbnail({
        base64: p.base64Png || "",
        width:  p.width || 0,
        height: p.height || 0,
        at:     Date.now(),
      });
    });

    RealTransBridge.on("hotkey:fired", ({ action }) => {
      if (action === "openPalette")   setPaletteOpen(true);
      if (action === "toggleOverlay") handleStartSelectionRef.current?.();
    });

    // C# selection window committed a screen rect → start session
    RealTransBridge.on("selection:committed", (p) => {
      if (selectingTimeoutRef.current) {
        clearTimeout(selectingTimeoutRef.current);
        selectingTimeoutRef.current = null;
      }
      setSelecting(false);
      setOverlayActive(true);
      RealTransBridge.send("session:start", {
        scenarioId: scenarioIdRef.current,
        renderMode: renderModeRef.current,
        regions: [{ id: "caption-band", x: p.rect.x, y: p.rect.y, w: p.rect.w, h: p.rect.h }],
      });
    });

    // C# selection window was cancelled (or closed unexpectedly)
    RealTransBridge.on("selection:cancelled", () => {
      if (selectingTimeoutRef.current) {
        clearTimeout(selectingTimeoutRef.current);
        selectingTimeoutRef.current = null;
      }
      setSelecting(false);
    });

    // Backend errors — surface them in the feed so the user (and the dev) sees
    // them instead of the UI hanging on "Waiting for text…" forever.
    RealTransBridge.on("error", (p) => {
      console.error("[backend:error]", p);
      const code = p.code || "error";
      setFeed(prev => [...prev.slice(-49), {
        kind: "error",
        code,
        message: p.message || "(no message)",
      }]);
      // Only auto-revert the UI to "not translating" for SETUP failures — the
      // session genuinely never started, so the Start button should come back.
      // For runtime errors (DXGI hiccups, transient capture failures, translator
      // timeouts), the session is still alive on the C# side, and clearing
      // overlayActive here would hide the Stop button — leaving the user with
      // no way to exit translation mode while the OCR loop keeps running. This
      // was the root cause of "how do I exit translation mode?" — the previous
      // blanket clear made the Stop button disappear behind any error toast.
      const SETUP_FAILURE_CODES = new Set([
        "session-start",
        "session-start-failed",
        "probe-threw",
        "resolve-processing-service",
        "no-ocr-engine",
        "ocr-language-not-installed",
      ]);
      if (SETUP_FAILURE_CODES.has(code)) {
        setSelecting(false);
        setOverlayActive(false);
      } else {
        // Still release the selecting flag — a runtime error doesn't imply the
        // selection window is stuck open, but if it was, the Start button now
        // shows as "Selecting region…" forever. Safer to clear it.
        setSelecting(false);
      }
    });
  }, []);

  // ── Global keyboard ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "KeyQ" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") {
        if (notesOpen)           setNotesOpen(false);
        else if (settingsOpen)   setSettingsOpen(false);
        else if (onboardingOpen) setOnboardingOpen(false);
        else if (paletteOpen)    setPaletteOpen(false);
        else if (overlayActive)  handleStop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, overlayActive, onboardingOpen, settingsOpen, notesOpen]);

  // ── Handlers ─────────────────────────────────────────────────────

  const selectingTimeoutRef = useRef(null);
  const handleStartSelection = () => {
    if (selecting) return;
    setSelecting(true);
    // C# hides this window, shows SelectionAreaWindow, sends back selection:committed
    RealTransBridge.send("selection:open", {});
    // Safety: if C# never replies (crash, swallowed exception), don't lock the user
    // out of the Start button forever. 15s is generous — normal flow completes in <3s.
    if (selectingTimeoutRef.current) clearTimeout(selectingTimeoutRef.current);
    selectingTimeoutRef.current = setTimeout(() => setSelecting(false), 15000);
  };
  // Keep the ref pointing at the latest handler so the bridge's hotkey:fired closure
  // (registered once in the useEffect([]) above) always invokes the current closure,
  // which reads the current `selecting` and preserves the re-entry guard.
  handleStartSelectionRef.current = handleStartSelection;

  const handlePaletteSelect = (cmd) => {
    setPaletteOpen(false);
    if (["select", "recent", "translate-window"].includes(cmd.action)) {
      setTimeout(handleStartSelection, 60);
    } else if (cmd.action === "settings") {
      setTimeout(() => setSettingsOpen(true), 60);
    }
  };

  const handleStop = () => {
    setOverlayActive(false);
    setFeed([]);
    setLatestPreview(null);
    setLatestTick(null);
    setLatestThumbnail(null);
    RealTransBridge.send("session:stop", { scenarioId });
  };

  const handleScenario = (id) => {
    if (overlayActive) {
      RealTransBridge.send("session:stop", { scenarioId });
      setOverlayActive(false);
    }
    setScenarioId(id);
  };

  // Live language switching. Updates the JS state immediately for UI feedback,
  // then mirrors to C# so the OCR engine + translator get rebuilt for the new
  // pair (via TranslationConfiguration.PropertyChanged in the legacy pipeline).
  const handleLanguageChange = ({ from, to }) => {
    const payload = {};
    if (from && from !== sourceLang) { setSourceLang(from); payload.translateFromLang = from; }
    if (to && to !== targetLang)     { setTargetLang(to);   payload.translateToLang   = to;   }
    if (Object.keys(payload).length > 0) {
      RealTransBridge.send("settings:set", payload);
    }
  };

  // Live translator switch (Google / DeepL / Yandex / Papago).
  const handleTranslatorChange = (name) => {
    if (name === translator) return;
    setTranslator(name);
    RealTransBridge.send("settings:set", { translator: name });
  };

  // Live OCR engine toggle. C# enforces "at least one engine enabled" — if we
  // disable everything, the guardrail re-enables WindowsOCR and the echoed
  // settings:state corrects our optimistic local update.
  const handleOcrEngineToggle = (name, enabled) => {
    if (ocrEngines[name] === enabled) return;
    const next = { ...ocrEngines, [name]: enabled };
    setOcrEngines(next);
    RealTransBridge.send("settings:set", { ocrEngines: { [name]: enabled } });
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="app-root">

      <ControlPanel
        scenarioId={scenarioId}
        onScenario={handleScenario}
        renderMode={renderMode}
        onRenderMode={setRenderMode}
        overlayActive={overlayActive}
        selecting={selecting}
        sourceLang={sourceLang}
        targetLang={targetLang}
        onLanguageChange={handleLanguageChange}
        translator={translator}
        onTranslatorChange={handleTranslatorChange}
        ocrEngines={ocrEngines}
        onOcrEngineToggle={handleOcrEngineToggle}
        onStart={handleStartSelection}
        onStop={handleStop}
        onPalette={() => setPaletteOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onOnboarding={() => setOnboardingOpen(true)}
        onNotes={() => setNotesOpen(true)}
      />

      <TranslationFeed
        overlayActive={overlayActive}
        feed={feed}
        renderMode={renderMode}
        sourceLang={sourceLang}
        targetLang={targetLang}
        latestPreview={latestPreview}
        latestTick={latestTick}
        latestThumbnail={latestThumbnail}
        onStop={handleStop}
      />

      <Palette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handlePaletteSelect}
        scenarioId={scenarioId}
      />

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Onboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      <Notes open={notesOpen} onClose={() => setNotesOpen(false)} />

    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

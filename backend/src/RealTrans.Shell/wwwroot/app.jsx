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
    RealTransBridge.on("ocr:preview", (p) => {
      setLatestPreview({ text: p.text || "", at: Date.now() });
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
      setFeed(prev => [...prev.slice(-49), {
        kind: "error",
        code: p.code || "error",
        message: p.message || "(no message)",
      }]);
      // An error during selection means the session never started — release the
      // selecting/overlay flags so the Start button comes back.
      setSelecting(false);
      setOverlayActive(false);
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
    RealTransBridge.send("session:stop", { scenarioId });
  };

  const handleScenario = (id) => {
    if (overlayActive) {
      RealTransBridge.send("session:stop", { scenarioId });
      setOverlayActive(false);
    }
    setScenarioId(id);
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
        latestPreview={latestPreview}
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

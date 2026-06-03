/* app.jsx — Production entry point.
   Two-column layout: ControlPanel (left) + TranslationFeed (right).
   All demo content (fake desktop, scenario windows) removed.
   Communicates with C# backend via RealTransBridge (bridge.js).
*/

const App = () => {
  const [scenarioId, setScenarioId]         = useState("anime");
  const [renderMode, setRenderMode]         = useState("replace");
  const [overlayActive, setOverlayActive]   = useState(false);
  const [paletteOpen, setPaletteOpen]       = useState(false);
  const [selecting, setSelecting]           = useState(false); // WPF selection window is open
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [notesOpen, setNotesOpen]           = useState(false);
  const [feed, setFeed]                     = useState([]);
  const [settings, setSettings]             = useState({}); // flat key→value store, hydrated from C#
  const [pins, setPins]                     = useState([]); // persisted pinned regions

  // Mirror the latest values into refs so the bridge handlers — registered once
  // in the useEffect([]) below and never re-registered — read current state instead
  // of stale first-render closures (the user can change scenario / render mode, or
  // toggle selection, before a selection commits).
  const scenarioIdRef = useRef(scenarioId);
  const renderModeRef = useRef(renderMode);
  const handleStartSelectionRef = useRef(null);
  const pinModeRef = useRef(false); // true → next selection commit pins a region instead of translating
  scenarioIdRef.current = scenarioId;
  renderModeRef.current = renderMode;

  // ── Bridge ───────────────────────────────────────────────────────
  useEffect(() => {
    RealTransBridge.ready();
    RealTransBridge.send("settings:get", {}); // request a snapshot in case state:init was missed

    RealTransBridge.on("state:init", (p) => {
      if (p.renderMode)     setRenderMode(p.renderMode);
      if (p.activeScenario) setScenarioId(p.activeScenario);
      if (p.settings)       setSettings(prev => ({ ...prev, ...p.settings }));
      if (p.pinnedRegions)  setPins(p.pinnedRegions);
    });

    RealTransBridge.on("settings:snapshot", (p) => {
      if (p.settings) setSettings(prev => ({ ...prev, ...p.settings }));
    });

    RealTransBridge.on("translation:result", (p) => {
      setFeed(prev => [...prev.slice(-49), p]);
    });

    RealTransBridge.on("hotkey:fired", ({ action }) => {
      if (action === "openPalette")   setPaletteOpen(true);
      if (action === "toggleOverlay") handleStartSelectionRef.current?.();
    });

    // C# selection window committed a screen rect → start a session, OR pin the region.
    RealTransBridge.on("selection:committed", (p) => {
      if (selectingTimeoutRef.current) {
        clearTimeout(selectingTimeoutRef.current);
        selectingTimeoutRef.current = null;
      }
      setSelecting(false);

      const rect = p.rect || {};
      if (pinModeRef.current) {
        // Pin-a-region flow: register a persisted pin, don't start translating.
        pinModeRef.current = false;
        RealTransBridge.send("region:pin", {
          label: `Pinned · ${scenarioIdRef.current}`,
          scenarioId: scenarioIdRef.current,
          x: rect.x, y: rect.y, w: rect.w, h: rect.h,
        });
        return;
      }

      setOverlayActive(true);
      RealTransBridge.send("session:start", {
        scenarioId: scenarioIdRef.current,
        renderMode: renderModeRef.current,
        regions: [{ id: "caption-band", x: rect.x, y: rect.y, w: rect.w, h: rect.h }],
      });
    });

    // C# selection window was cancelled (or closed unexpectedly)
    RealTransBridge.on("selection:cancelled", () => {
      if (selectingTimeoutRef.current) {
        clearTimeout(selectingTimeoutRef.current);
        selectingTimeoutRef.current = null;
      }
      pinModeRef.current = false;
      setSelecting(false);
    });

    // Backend errors — surface them in the feed so the user (and the dev) sees
    // them instead of the UI hanging on "Waiting for text…" forever.
    RealTransBridge.on("error", (p) => {
      console.error("[backend:error]", p);
      setFeed(prev => [...prev.slice(-49), {
        regionId: "system",
        sourceText: `[${p.code || "error"}]`,
        translatedText: p.message || "(no message)",
        elapsedMs: 0,
      }]);
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

  // Persist a single setting and update local state optimistically.
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === "renderMode" || key === "renderStyle") setRenderMode(value);
    RealTransBridge.send("settings:set", { key, value });
  };

  const handleRenderMode = (id) => {
    setRenderMode(id);
    setSettings(prev => ({ ...prev, renderMode: id, renderStyle: id }));
    RealTransBridge.send("settings:set", { key: "renderMode", value: id });
  };

  const handleReassignHotkey = (action, key, modifiers) => {
    RealTransBridge.send("hotkey:reassign", { action, key, modifiers });
  };

  const handleUnpinRegion = (id) => {
    setPins(prev => prev.filter(p => p.id !== id));
    RealTransBridge.send("region:unpin", { id });
  };

  const handlePinRegion = () => {
    setSettingsOpen(false);
    pinModeRef.current = true;
    setTimeout(handleStartSelection, 60);
  };

  const handlePaletteSelect = (cmd) => {
    setPaletteOpen(false);
    switch (cmd.action) {
      case "select":
      case "recent":
      case "translate-window":
        setTimeout(handleStartSelection, 60);
        break;
      case "pin":
        setTimeout(handlePinRegion, 60);
        break;
      case "mode":
        // mode commands carry their scenario in the id, e.g. "mode-game" → "game"
        if (typeof cmd.id === "string" && cmd.id.startsWith("mode-")) {
          handleScenario(cmd.id.slice("mode-".length));
        }
        break;
      case "settings":
      case "lang":
        setTimeout(() => setSettingsOpen(true), 60);
        break;
      default:
        break;
    }
  };

  const handleStop = () => {
    setOverlayActive(false);
    setFeed([]);
    RealTransBridge.send("session:stop", { scenarioId });
  };

  const handleScenario = (id) => {
    if (overlayActive) {
      RealTransBridge.send("session:stop", { scenarioId });
      setOverlayActive(false);
    }
    setScenarioId(id);
    RealTransBridge.send("settings:set", { key: "activeScenarioId", value: id });
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="app-root">

      <ControlPanel
        scenarioId={scenarioId}
        onScenario={handleScenario}
        renderMode={renderMode}
        onRenderMode={handleRenderMode}
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
        onStop={handleStop}
      />

      <Palette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handlePaletteSelect}
        scenarioId={scenarioId}
      />

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingChange}
        renderMode={renderMode}
        pins={pins}
        onUnpinRegion={handleUnpinRegion}
        onPinRegion={handlePinRegion}
        onReassignHotkey={handleReassignHotkey}
      />
      <Onboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      <Notes open={notesOpen} onClose={() => setNotesOpen(false)} />

    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

/* app.jsx — main App entry point.
   Orchestrates state, scenario switching, palette / selection / overlay flow.
*/

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "renderMode": "replace",
  "accentHue": "violet",
  "showHotkeyHint": true,
  "autoCycleSubs": true,
  "subtitleSize": 26
}/*EDITMODE-END*/;

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [scenarioId, setScenarioId] = useState("anime");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState("yuki");
  const [captionIndex, setCaptionIndex] = useState(0);
  const [time, setTime] = useState("21:08");
  const [lastTranslation, setLastTranslation] = useState(null);

  // bridge: signal ready and subscribe to C# events
  useEffect(() => {
    RealTransBridge.ready();

    RealTransBridge.on("state:init", (p) => {
      if (p.renderMode)     setTweak("renderMode", p.renderMode);
      if (p.activeScenario) setScenarioId(p.activeScenario);
    });

    RealTransBridge.on("translation:result", (p) => {
      setLastTranslation(p);
    });

    RealTransBridge.on("hotkey:fired", ({ action }) => {
      if (action === "openPalette")   setPaletteOpen(true);
      if (action === "toggleOverlay") setOverlayActive(v => !v);
    });
  }, []);

  // live tick for subtitle/caption advance
  useEffect(() => {
    if (!t.autoCycleSubs) return;
    if (scenarioId === "anime") {
      const id = setInterval(() => {
        setSubtitleIndex(i => (i + 1) % ANIME_TIMELINE.length);
      }, 3500);
      return () => clearInterval(id);
    }
    if (scenarioId === "meeting") {
      const id = setInterval(() => {
        setCaptionIndex(i => {
          const next = (i + 1) % MEETING_TIMELINE.length;
          setActiveSpeaker(MEETING_TIMELINE[next].speaker);
          return next;
        });
      }, 3500);
      return () => clearInterval(id);
    }
  }, [scenarioId, t.autoCycleSubs]);

  // clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // global keyboard
  useEffect(() => {
    const k = (e) => {
      // ⌃⌥Space — open palette
      if (e.code === "Space" && (e.ctrlKey || e.metaKey) && e.altKey) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      // Escape — close topmost surface first
      if (e.key === "Escape") {
        if (notesOpen) setNotesOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (onboardingOpen) setOnboardingOpen(false);
        else if (paletteOpen) setPaletteOpen(false);
        else if (selectionOpen) setSelectionOpen(false);
        else if (overlayActive) setOverlayActive(false);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [paletteOpen, selectionOpen, overlayActive, onboardingOpen, settingsOpen, notesOpen]);

  const handlePaletteSelect = (cmd) => {
    setPaletteOpen(false);
    if (cmd.action === "select" || cmd.action === "recent" || cmd.action === "translate-window") {
      setTimeout(() => setSelectionOpen(true), 60);
    } else if (cmd.action === "settings") {
      setTimeout(() => setSettingsOpen(true), 60);
    }
  };

  // screenRect = { x, y, w, h } in physical screen pixels from SelectionOverlay
  const handleCommit = (screenRect) => {
    setSelectionOpen(false);
    setOverlayActive(true);
    if (screenRect) {
      RealTransBridge.send("session:start", {
        scenarioId,
        renderMode: t.renderMode,
        regions: [{ id: "caption-band", ...screenRect }],
      });
    }
  };

  const handleStopSession = () => {
    setOverlayActive(false);
    setLastTranslation(null);
    RealTransBridge.send("session:stop", { scenarioId });
  };

  // map current scenario to mode glyph
  const sceneProps = {
    subtitleIndex,
    captionIndex,
    activeSpeaker,
    replaceText: overlayActive && t.renderMode === "replace",
  };

  const renderScene = () => {
    switch (scenarioId) {
      case "browser": return <SceneBrowser {...sceneProps} />;
      case "anime":   return <SceneAnime {...sceneProps} />;
      case "game":    return <SceneGame {...sceneProps} />;
      case "manga":   return <SceneManga {...sceneProps} />;
      case "meeting": return <SceneMeeting {...sceneProps} />;
      default: return null;
    }
  };

  return (
    <div className="stage">
      <div className="stage-main">
        <Desktop
          scenario={SCENARIOS[scenarioId]}
          scenarioId={scenarioId}
          time={time}
          onTaskbarTranslate={() => setPaletteOpen(true)}
          palettOpen={paletteOpen}
        >
          {renderScene()}

          <OverlayLayer
            scenarioId={scenarioId}
            renderMode={t.renderMode}
            isActive={overlayActive}
            subtitleIndex={subtitleIndex}
            captionIndex={captionIndex}
          />

          {selectionOpen && (
            <SelectionOverlay
              scenarioId={scenarioId}
              onCommit={handleCommit}
              onCancel={() => setSelectionOpen(false)}
            />
          )}

          <Palette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onSelect={handlePaletteSelect}
            scenarioId={scenarioId}
          />

          <Onboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
          <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <Notes open={notesOpen} onClose={() => setNotesOpen(false)} />

          {!overlayActive && !selectionOpen && !paletteOpen && t.showHotkeyHint && (
            <HotkeyHint onClick={() => setPaletteOpen(true)} />
          )}

          {overlayActive && (
            <TranslatedBanner
              onDismiss={handleStopSession}
              renderMode={t.renderMode}
              lastTranslation={lastTranslation}
            />
          )}
        </Desktop>
      </div>
    </div>
  );
};

/* ── Subtle pulse in the corner saying "press ⌃⌥Space" ─────────── */
const HotkeyHint = ({ onClick }) => (
  <div onClick={onClick} style={{
    position: "absolute", right: 14, top: 50, zIndex: 20,
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 12px", borderRadius: 999,
    background: "rgba(20,21,28,0.78)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    border: "0.5px solid var(--rt-line-2)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 0 0 rgba(139,124,255,0.5)",
    color: "var(--rt-fg-2)", fontSize: 10.5, fontWeight: 500,
    cursor: "pointer",
    animation: "rt-glow-pulse 3s infinite",
  }}>
    <Wordmark size={11} withText={false} />
    <span style={{ color: "var(--rt-fg-3)" }}>idle ·</span>
    <span className="kbd">⌃</span><span className="kbd">⌥</span><span className="kbd">Space</span>
    <span style={{ color: "var(--rt-fg-3)" }}>to translate</span>
  </div>
);

/* ── Pill telling the user a translation is active ─────────────── */
const TranslatedBanner = ({ onDismiss, renderMode, lastTranslation }) => {
  const modeLabels = { replace: "Replace", ghost: "Ghost", parallel: "Parallel", card: "Card" };
  const elapsed = lastTranslation ? `${lastTranslation.elapsedMs} ms` : "—";
  return (
    <div style={{
      position: "absolute", left: "50%", transform: "translateX(-50%)",
      top: 14, zIndex: 25,
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 14px 7px 12px", borderRadius: 999,
      background: "rgba(20,21,28,0.85)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "0.5px solid rgba(139,124,255,0.4)",
      boxShadow: "0 8px 28px rgba(0,0,0,0.55), 0 0 24px rgba(139,124,255,0.16)",
      animation: "rt-pop-in 0.3s var(--rt-ease-2) both",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 999,
        background: "#5eead4", boxShadow: "0 0 8px #5eead4",
        animation: "rt-blink 1.4s infinite",
      }} />
      <span style={{ fontSize: 11, color: "var(--rt-fg)", fontWeight: 500 }}>
        Translating · {modeLabels[renderMode] || renderMode}
      </span>
      <span style={{ fontSize: 10.5, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)" }}>JA → EN · {elapsed}</span>
      <button onClick={onDismiss} style={{
        background: "transparent", border: 0, color: "var(--rt-fg-3)",
        cursor: "pointer", padding: 2, display: "flex",
      }}>
        <Icon name="x" size={12}/>
      </button>
    </div>
  );
};

/* mount */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

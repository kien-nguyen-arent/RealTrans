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

  const handleCommit = () => {
    setSelectionOpen(false);
    setOverlayActive(true);
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
      <div className="stage-rail">
        <DemoController
          scenarioId={scenarioId}
          onScenario={(s) => {
            setScenarioId(s);
            setOverlayActive(false);
          }}
          renderMode={t.renderMode}
          onRenderMode={(m) => setTweak("renderMode", m)}
          onPalette={() => setPaletteOpen(true)}
          onSelection={() => setSelectionOpen(true)}
          onOnboarding={() => setOnboardingOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onNotes={() => setNotesOpen(true)}
          isTranslated={overlayActive}
        />
      </div>

      <div className="stage-main">
        <Desktop scenarioId={scenarioId}>
        {/* the actual scenario */}
        {renderScene()}

        {/* overlay layer (for non-replace modes, or browser replace) */}
        <OverlayLayer
          scenarioId={scenarioId}
          renderMode={t.renderMode}
          isActive={overlayActive}
          subtitleIndex={subtitleIndex}
          captionIndex={captionIndex}
        />

        {/* selection overlay */}
        {selectionOpen && (
          <SelectionOverlay
            scenarioId={scenarioId}
            onCommit={handleCommit}
            onCancel={() => setSelectionOpen(false)}
          />
        )}

        {/* command palette */}
        <Palette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelect={handlePaletteSelect}
          scenarioId={scenarioId}
        />

        {/* onboarding */}
        <Onboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

        {/* settings */}
        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* notes */}
        <Notes open={notesOpen} onClose={() => setNotesOpen(false)} />

        {/* hotkey hint pulse - bottom right */}
        {!overlayActive && !selectionOpen && !paletteOpen && t.showHotkeyHint && (
          <HotkeyHint onClick={() => setPaletteOpen(true)} />
        )}

        {/* translated-state pill - shows when overlay is active */}
        {overlayActive && (
          <TranslatedBanner onDismiss={() => setOverlayActive(false)} renderMode={t.renderMode} />
        )}
      </Desktop>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Overlay" />
        <TweakRadio label="Render style" value={t.renderMode}
          options={[
            { value: "replace", label: "Replace" },
            { value: "ghost", label: "Ghost" },
            { value: "parallel", label: "Parallel" },
            { value: "card", label: "Card" },
          ]}
          onChange={(v) => setTweak("renderMode", v)}
        />
        <TweakSection label="Live content" />
        <TweakToggle label="Auto-cycle subs / captions" value={t.autoCycleSubs} onChange={v => setTweak("autoCycleSubs", v)} />
        <TweakSlider label="Subtitle size (anime)" value={t.subtitleSize} min={16} max={42} unit="px"
          onChange={v => setTweak("subtitleSize", v)} />
        <TweakSection label="Chrome" />
        <TweakToggle label="Show hotkey hint" value={t.showHotkeyHint} onChange={v => setTweak("showHotkeyHint", v)} />
      </TweaksPanel>
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
const TranslatedBanner = ({ onDismiss, renderMode }) => {
  const modeLabels = { replace: "Replace", ghost: "Ghost", parallel: "Parallel", card: "Card" };
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
      <span style={{ fontSize: 10.5, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)" }}>JA → EN · 282 ms</span>
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

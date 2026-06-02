/* demo-controller.jsx — A small floating panel that lets the
   user navigate the prototype: switch scenarios, fire flows, open notes.
   Sits in the top-left of the desktop, glassy, collapsible.
*/

const DemoController = ({
  scenarioId, onScenario,
  renderMode, onRenderMode,
  onPalette, onSelection, onOnboarding, onSettings, onNotes,
  isTranslated,
}) => {
  const scenes = ["browser", "anime", "game", "manga", "meeting"];

  return (
    <div style={{
      width: "100%",
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
    }}>
      <div className="glass-strong" style={{ borderRadius: 14, padding: 12, color: "var(--rt-fg)" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Wordmark size={14} withText={false} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>Demo controller</div>
            <div style={{ fontSize: 9.5, color: "var(--rt-fg-3)" }}>Drive the prototype from here</div>
          </div>
        </div>

        {/* scenario */}
        <DCSection label="Scene">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {scenes.map(s => (
              <button key={s} onClick={() => onScenario(s)} title={SCENARIOS[s].label} style={{
                padding: "8px 0", border: 0, borderRadius: 7,
                background: scenarioId === s ? "rgba(139,124,255,0.20)" : "rgba(255,255,255,0.04)",
                color: scenarioId === s ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit",
              }}>
                <Icon name={SCENARIOS[s].icon} size={13}/>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--rt-fg-3)", marginTop: 5, textAlign: "center" }}>
            {SCENARIOS[scenarioId].label} · {SCENARIOS[scenarioId].sub}
          </div>
        </DCSection>

        {/* primary actions */}
        <DCSection label="Try">
          <button onClick={onPalette} style={dcBtnStyle(true)}>
            <Icon name="command" size={12}/> Press <span className="kbd" style={{ fontSize: 9.5 }}>⌃</span><span className="kbd" style={{ fontSize: 9.5 }}>⌥</span><span className="kbd" style={{ fontSize: 9.5 }}>Space</span>
          </button>
          <button onClick={onSelection} style={dcBtnStyle()}>
            <Icon name="crosshair" size={12}/> Selection mode
          </button>
        </DCSection>

        {/* render mode */}
        <DCSection label={isTranslated ? "Overlay style · live" : "Overlay style"}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
            {[
              { id: "replace", label: "Replace", icon: "wand" },
              { id: "ghost",   label: "Ghost",   icon: "eye" },
              { id: "parallel",label: "Parallel",icon: "layers" },
              { id: "card",    label: "Card",    icon: "stack" },
            ].map(m => (
              <button key={m.id} onClick={() => onRenderMode(m.id)} style={{
                padding: "6px 8px", border: 0, borderRadius: 6,
                background: renderMode === m.id ? "rgba(139,124,255,0.20)" : "rgba(255,255,255,0.04)",
                color: renderMode === m.id ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontFamily: "inherit",
              }}>
                <Icon name={m.icon} size={11}/>{m.label}
              </button>
            ))}
          </div>
        </DCSection>

        {/* explore */}
        <DCSection label="Explore">
          <button onClick={onOnboarding} style={dcBtnStyle()}>
            <Icon name="sparkle" size={12}/> Onboarding
          </button>
          <button onClick={onSettings} style={dcBtnStyle()}>
            <Icon name="settings" size={12}/> Settings
          </button>
          <button onClick={onNotes} style={dcBtnStyle()}>
            <Icon name="notes" size={12}/> Founder notes
          </button>
        </DCSection>

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "0.5px solid var(--rt-line)", fontSize: 9.5, color: "var(--rt-fg-3)", lineHeight: 1.4 }}>
          Real RealTrans has no UI when idle. This panel only exists for the prototype.
        </div>
      </div>
    </div>
  );
};

const DCSection = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{
      fontSize: 9, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)",
      marginBottom: 5,
    }}>{label}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
  </div>
);

const dcBtnStyle = (primary) => ({
  width: "100%", padding: "7px 10px", border: 0, borderRadius: 7,
  background: primary ? "rgba(139,124,255,0.20)" : "rgba(255,255,255,0.05)",
  color: primary ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
  fontSize: 11, fontWeight: 500,
  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
  fontFamily: "inherit",
  textAlign: "left",
});

Object.assign(window, { DemoController });

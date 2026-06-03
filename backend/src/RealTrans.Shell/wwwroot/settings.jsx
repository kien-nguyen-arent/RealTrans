/* settings.jsx — RealTrans settings panel
   Drawer-style modal with tabs: General · Pinned regions · Appearance · Hotkeys · Advanced.
*/

const Settings = ({ open, onClose }) => {
  const [tab, setTab] = useState("regions");
  if (!open) return null;

  const tabs = [
    { id: "general", label: "General", icon: "settings" },
    { id: "regions", label: "Pinned regions", icon: "pin" },
    { id: "modes", label: "Modes", icon: "layers" },
    { id: "appearance", label: "Appearance", icon: "eye" },
    { id: "hotkeys", label: "Hotkeys", icon: "keyboard" },
    { id: "advanced", label: "Advanced", icon: "sparkle" },
  ];

  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        zIndex: 80, animation: "rt-fade-in 0.2s var(--rt-ease) both",
      }}/>
      <div style={{
        position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)",
        zIndex: 81, width: 780, maxHeight: "84%",
        animation: "rt-pop-in 0.28s var(--rt-ease-2) both",
      }}>
        <div className="glass-strong" style={{ borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "84vh" }}>
          {/* header */}
          <div style={{
            padding: "14px 20px", borderBottom: "0.5px solid var(--rt-line-2)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <Wordmark size={16} />
            <span style={{ fontSize: 12, color: "var(--rt-fg-3)" }}>· Settings</span>
            <div style={{ flex: 1 }}/>
            <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--rt-fg-3)", cursor: "pointer", padding: 4 }}><Icon name="x" size={16}/></button>
          </div>

          {/* body */}
          <div style={{ display: "flex", minHeight: 480, flex: 1, overflow: "hidden" }}>
            {/* sidebar */}
            <div style={{
              width: 180, padding: 8,
              borderRight: "0.5px solid var(--rt-line-2)",
              display: "flex", flexDirection: "column", gap: 1,
            }}>
              {tabs.map(t => (
                <SettingsTab key={t.id} {...t} active={tab === t.id} onClick={() => setTab(t.id)} />
              ))}
            </div>

            {/* content */}
            <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
              {tab === "general" && <GeneralPane />}
              {tab === "regions" && <RegionsPane />}
              {tab === "modes" && <ModesPane />}
              {tab === "appearance" && <AppearancePane />}
              {tab === "hotkeys" && <HotkeysPane />}
              {tab === "advanced" && <AdvancedPane />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const SettingsTab = ({ id, label, icon, active, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 9,
    padding: "8px 10px", borderRadius: 7, cursor: "pointer",
    background: active ? "rgba(139,124,255,0.16)" : "transparent",
    color: active ? "var(--rt-fg)" : "var(--rt-fg-2)",
    fontSize: 12.5, fontWeight: 500,
  }}>
    <Icon name={icon} size={13}/>
    {label}
  </div>
);

const SectionHeader = ({ title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h2>
    {sub && <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12.5, color: "var(--rt-fg-3)", lineHeight: 1.5 }}>{sub}</p>}
  </div>
);

const Row = ({ label, sub, children }) => (
  <div style={{ display: "flex", alignItems: "center", padding: "12px 0", gap: 16, borderBottom: "0.5px solid var(--rt-line)" }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--rt-fg-3)", marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
    </div>
    {children}
  </div>
);

const Toggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{
    width: 32, height: 18, borderRadius: 999,
    background: value ? "var(--rt-accent)" : "rgba(255,255,255,0.1)",
    position: "relative", cursor: "pointer",
    transition: "background .15s var(--rt-ease)",
  }}>
    <div style={{
      position: "absolute", top: 2, left: value ? 16 : 2,
      width: 14, height: 14, borderRadius: 999, background: "#fff",
      transition: "left .15s var(--rt-ease)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    }}/>
  </div>
);

const Select = ({ value, options }) => (
  <div style={{
    padding: "5px 10px", borderRadius: 7,
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid var(--rt-line-2)",
    fontSize: 12, color: "var(--rt-fg)",
    minWidth: 140, display: "flex", alignItems: "center", justifyContent: "space-between",
  }}>{value}<span style={{ color: "var(--rt-fg-3)" }}>▾</span></div>
);

/* ── panes ────────────────────────────────────────────────────── */
const GeneralPane = () => (
  <div>
    <SectionHeader title="General" sub="Default behavior. Anything mode-specific is in Modes." />
    <Row label="Launch at startup" sub="Stays in the system tray, ready for your hotkey.">
      <Toggle value={true} onChange={()=>{}}/>
    </Row>
    <Row label="Translation source" sub="Auto-detect uses on-device language ID.">
      <Select value="Auto-detect" />
    </Row>
    <Row label="Translation target">
      <Select value="English" />
    </Row>
    <Row label="OCR engine" sub="On-device runs offline. Cloud is faster on long passages.">
      <Select value="On-device · v4" />
    </Row>
    <Row label="Translation engine" sub="Memory-aware: prior glossary terms are always preferred.">
      <Select value="RealTrans Pro · v2" />
    </Row>
    <Row label="Latency budget" sub="Lower = faster but choppier on long passages.">
      <Select value="280 ms · Balanced" />
    </Row>
  </div>
);

const RegionsPane = () => {
  const regions = [
    { id: 1, name: "Final Quest VII · Dialogue", target: "Window: Final Quest VII", live: false, count: 412, last: "2h ago" },
    { id: 2, name: "Crunchyroll · Subtitle band", target: "Pattern: bottom 18% of *.crunchyroll.com", live: true, count: 1284, last: "now" },
    { id: 3, name: "FFXIV · Quest log", target: "Window: FINAL FANTASY XIV", live: false, count: 230, last: "yesterday" },
    { id: 4, name: "Twitter · @yamada_d", target: "URL: x.com/yamada_d/*", live: false, count: 47, last: "3d ago" },
  ];
  return (
    <div>
      <SectionHeader title="Pinned regions" sub="Regions follow their target window or URL and re-translate as content changes. Drag to reorder; click to open." />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {regions.map(r => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid var(--rt-line-2)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: r.live ? "rgba(94,234,212,0.16)" : "rgba(139,124,255,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: r.live ? "#5eead4" : "var(--rt-accent-bright)",
            }}>
              <Icon name="pin" size={14}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500 }}>
                {r.name}
                {r.live && <span style={{ fontSize: 9.5, color: "#5eead4", padding: "1px 6px", borderRadius: 4, background: "rgba(94,234,212,0.12)", fontFamily: "var(--rt-mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}>● live</span>}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)" }}>{r.target}</div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--rt-fg-3)", textAlign: "right" }}>
              <div>{r.count} lines</div>
              <div style={{ fontSize: 10 }}>{r.last}</div>
            </div>
            <Icon name="more" size={14} style={{ color: "var(--rt-fg-3)" }}/>
          </div>
        ))}
      </div>
      <button style={{
        marginTop: 12, padding: "8px 12px", borderRadius: 8,
        background: "rgba(139,124,255,0.16)",
        border: "0.5px solid rgba(139,124,255,0.4)",
        color: "var(--rt-accent-bright)", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <Icon name="pin" size={12}/> Pin new region
      </button>
    </div>
  );
};

const ModesPane = () => {
  const modes = [
    { id: "doc", name: "Document", desc: "Long-form text. Translates paragraph by paragraph, preserves typography hierarchy.", icon: "browser", on: true },
    { id: "sub", name: "Subtitles", desc: "Tracks subtitle band frame-by-frame. Smooths jitter from re-OCR.", icon: "play", on: true },
    { id: "game", name: "Gaming", desc: "Pinned regions follow the game window. Low-priority CPU. No focus stealing.", icon: "joystick", on: true },
    { id: "manga", name: "Manga", desc: "Detects bubbles automatically. Matches lettering style (bold for emphasis).", icon: "manga", on: true },
    { id: "live", name: "Live captions", desc: "Captures audio + screen. Speaker-aware. Lower-third caption strip.", icon: "video", on: false },
    { id: "stream", name: "Streamer mode", desc: "Translated captions go to OBS via virtual display. No tray, no notifications.", icon: "mic", on: false, beta: true },
  ];
  return (
    <div>
      <SectionHeader title="Modes" sub="RealTrans switches modes automatically based on the active window. You can lock a mode for a specific app." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {modes.map(m => (
          <div key={m.id} style={{
            padding: 14, borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid var(--rt-line-2)",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: m.on ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.04)",
              color: m.on ? "var(--rt-accent-bright)" : "var(--rt-fg-3)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name={m.icon} size={15}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                {m.beta && <Pill mono accent style={{ fontSize: 9, padding: "1px 6px" }}>Beta</Pill>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--rt-fg-3)", marginTop: 3, lineHeight: 1.5 }}>{m.desc}</div>
            </div>
            <Toggle value={m.on} onChange={()=>{}}/>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppearancePane = () => (
  <div>
    <SectionHeader title="Appearance" sub="How translations look when overlaid. Per-mode overrides live inside Modes." />
    <Row label="Overlay render style" sub="Replace = in-place. Ghost = layered. Parallel = adjacent. Card = consolidated.">
      <div style={{ display: "flex", gap: 4 }}>
        {["Replace", "Ghost", "Parallel", "Card"].map((s, i) => (
          <div key={s} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11,
            background: i === 0 ? "rgba(139,124,255,0.20)" : "rgba(255,255,255,0.05)",
            color: i === 0 ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
            border: "0.5px solid var(--rt-line-2)",
          }}>{s}</div>
        ))}
      </div>
    </Row>
    <Row label="Match source typography" sub="Mimic the font, color, and weight of the source where possible.">
      <Toggle value={true} onChange={()=>{}}/>
    </Row>
    <Row label="Stabilize subtitles" sub="Wait for OCR to settle before swapping text (avoids flicker).">
      <Toggle value={true} onChange={()=>{}}/>
    </Row>
    <Row label="Background opacity" sub="How visible the surrounding source is.">
      <span className="mono" style={{ fontSize: 11.5, color: "var(--rt-fg-2)" }}>92%</span>
    </Row>
    <Row label="Dim original on hover" sub="When mousing over a translated region, show the source.">
      <Toggle value={true} onChange={()=>{}}/>
    </Row>
  </div>
);

const HotkeysPane = () => {
  const keys = [
    { name: "Activate RealTrans", k: ["Alt", "Q"] },
    { name: "Translate active window", k: ["⌃", "⌥", "W"] },
    { name: "Toggle pinned region", k: ["⌃", "⌥", "P"] },
    { name: "Cycle overlay style", k: ["⌃", "⌥", "O"] },
    { name: "Pause translations", k: ["⌃", "⌥", "."] },
    { name: "Show original on hold", k: ["⌥"] },
    { name: "Open command palette", k: ["Alt", "Q"] },
  ];
  return (
    <div>
      <SectionHeader title="Hotkeys" sub="All shortcuts are global. Hold modifiers to preview alternatives in any palette." />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {keys.map(k => (
          <div key={k.name} style={{ display: "flex", alignItems: "center", padding: "10px 4px", borderBottom: "0.5px solid var(--rt-line)" }}>
            <span style={{ flex: 1, fontSize: 12.5 }}>{k.name}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {k.k.map((x, i) => <span key={i} className="kbd">{x}</span>)}
            </div>
            <button style={{ marginLeft: 12, background: "transparent", border: 0, color: "var(--rt-fg-3)", cursor: "pointer", fontSize: 11 }}>Rebind</button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdvancedPane = () => (
  <div>
    <SectionHeader title="Advanced" sub="Power-user controls. Default to off unless you know what you're doing." />
    <Row label="Glossary memory" sub="Remember preferred translations for specific proper nouns and phrases.">
      <Toggle value={true} onChange={()=>{}}/>
    </Row>
    <Row label="Per-app voice" sub="Tone-match translation to genre (e.g. JRPGs get archaic English).">
      <Toggle value={true} onChange={()=>{}}/>
    </Row>
    <Row label="Predictive translation" sub="Pre-translate the next likely line for live content (lower perceived latency).">
      <Toggle value={false} onChange={()=>{}}/>
    </Row>
    <Row label="OBS bridge" sub="Stream translated captions to a virtual display source.">
      <Toggle value={false} onChange={()=>{}}/>
    </Row>
    <Row label="Telemetry" sub="Anonymized usage that helps RealTrans learn region-detection patterns.">
      <Toggle value={false} onChange={()=>{}}/>
    </Row>
    <Row label="Reset learned glossary" sub="Erase all per-app vocabulary memory.">
      <button style={{ padding: "4px 10px", border: "0.5px solid rgba(244,113,168,0.4)", color: "#f471a8", background: "rgba(244,113,168,0.1)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Reset…</button>
    </Row>
  </div>
);

Object.assign(window, { Settings });

/* settings.jsx — RealTrans settings panel
   Drawer-style modal with tabs: General · Pinned regions · Modes · Appearance · Hotkeys · Advanced.

   Every control is wired to the settings store passed from App:
     props.settings  — flat { key: value } object (values may be string or boolean)
     props.onChange(key, value) — persist one setting (App → bridge → C#)
   Backend-meaningful keys (renderMode, activeScenarioId) round-trip to RealTransConfiguration.
*/

/* ── value coercion helpers ──────────────────────────────────────── */
const asBool = (v, def) =>
  v === true || v === "true" ? true : (v === false || v === "false" ? false : def);
const asStr = (v, def) => (v === undefined || v === null ? def : String(v));

/* ── option lists for selects ────────────────────────────────────── */
const SOURCE_LANGS = ["Auto-detect", "日本語 (Japanese)", "한국어 (Korean)", "中文 (Chinese)", "English"];
const TARGET_LANGS = ["English", "Tiếng Việt (Vietnamese)", "日本語 (Japanese)", "한국어 (Korean)", "中文 (Chinese)"];
const OCR_ENGINES = ["On-device · v4", "Cloud · Google Vision", "Cloud · GPT-4o vision"];
const TRANSLATION_ENGINES = ["RealTrans Pro · v2", "DeepL", "Google Translate", "GPT-4o", "Claude"];
const LATENCY_BUDGETS = ["180 ms · Fast", "280 ms · Balanced", "480 ms · Quality"];
const OPACITY_OPTS = ["75%", "85%", "92%", "100%"];

const Settings = ({ open, onClose, settings = {}, onChange = () => {}, renderMode,
                    pins = [], onUnpinRegion = () => {}, onPinRegion = () => {},
                    onReassignHotkey = () => {} }) => {
  const [tab, setTab] = useState("general");
  const { boxRef, startDrag, anchorStyle } = useDraggableModal(open);
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
      <div ref={boxRef} style={{
        position: "absolute", ...anchorStyle,
        zIndex: 81, width: 780, maxHeight: "84%",
      }}>
        <div className="glass-strong" style={{
          borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "84vh",
          animation: "rt-pop-in 0.28s var(--rt-ease-2) both",
        }}>
          {/* header — drag to move */}
          <div onMouseDown={startDrag} style={{
            padding: "14px 20px", borderBottom: "0.5px solid var(--rt-line-2)",
            display: "flex", alignItems: "center", gap: 12,
            cursor: "move", userSelect: "none",
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
              {tab === "general" && <GeneralPane settings={settings} onChange={onChange} />}
              {tab === "regions" && <RegionsPane pins={pins} onUnpin={onUnpinRegion} onPin={onPinRegion} />}
              {tab === "modes" && <ModesPane settings={settings} onChange={onChange} />}
              {tab === "appearance" && <AppearancePane settings={settings} onChange={onChange} renderMode={renderMode} />}
              {tab === "hotkeys" && <HotkeysPane settings={settings} onChange={onChange} onReassignHotkey={onReassignHotkey} />}
              {tab === "advanced" && <AdvancedPane settings={settings} onChange={onChange} />}
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
  <div onClick={() => onChange(!value)} role="switch" aria-checked={!!value} style={{
    width: 32, height: 18, borderRadius: 999,
    background: value ? "var(--rt-accent)" : "rgba(255,255,255,0.1)",
    position: "relative", cursor: "pointer", flexShrink: 0,
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

/* Functional dropdown. Menu is portaled to <body> and positioned with fixed
   coordinates so it is never clipped by the settings modal's overflow:hidden. */
const Select = ({ value, options = [], onChange = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 180) });
    setOpen(true);
  };

  const menu = open && pos ? ReactDOM.createPortal(
    <>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 300 }} />
      <div style={{
        position: "fixed", left: pos.left, top: pos.top, minWidth: pos.width, zIndex: 301,
        background: "var(--rt-bg-3)", border: "0.5px solid var(--rt-line-2)",
        borderRadius: 8, padding: 4, boxShadow: "0 14px 36px rgba(0,0,0,0.55)",
        maxHeight: 260, overflowY: "auto",
      }}>
        {options.map(opt => (
          <div key={opt} onClick={() => { onChange(opt); setOpen(false); }} style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
            color: opt === value ? "var(--rt-accent-bright)" : "var(--rt-fg)",
            background: opt === value ? "rgba(139,124,255,0.12)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, whiteSpace: "nowrap",
          }}>
            {opt}{opt === value && <Icon name="check" size={12} />}
          </div>
        ))}
      </div>
    </>, document.body) : null;

  return (
    <>
      <div ref={triggerRef} onClick={toggle} style={{
        padding: "5px 10px", borderRadius: 7,
        background: "rgba(255,255,255,0.06)",
        border: "0.5px solid var(--rt-line-2)",
        fontSize: 12, color: "var(--rt-fg)",
        minWidth: 140, display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer", gap: 8,
      }}>{value}<span style={{ color: "var(--rt-fg-3)" }}>▾</span></div>
      {menu}
    </>
  );
};

/* ── panes ────────────────────────────────────────────────────── */
const GeneralPane = ({ settings, onChange }) => (
  <div>
    <SectionHeader title="General" sub="Default behavior. Anything mode-specific is in Modes." />
    <Row label="Launch at startup" sub="Stays in the system tray, ready for your hotkey.">
      <Toggle value={asBool(settings.launchAtStartup, true)} onChange={v => onChange("launchAtStartup", v)}/>
    </Row>
    <Row label="Translation source" sub="Auto-detect uses on-device language ID.">
      <Select value={asStr(settings.sourceLang, "Auto-detect")} options={SOURCE_LANGS} onChange={v => onChange("sourceLang", v)} />
    </Row>
    <Row label="Translation target">
      <Select value={asStr(settings.targetLang, "English")} options={TARGET_LANGS} onChange={v => onChange("targetLang", v)} />
    </Row>
    <Row label="OCR engine" sub="On-device runs offline. Cloud is faster on long passages.">
      <Select value={asStr(settings.ocrEngine, "On-device · v4")} options={OCR_ENGINES} onChange={v => onChange("ocrEngine", v)} />
    </Row>
    <Row label="Translation engine" sub="Memory-aware: prior glossary terms are always preferred.">
      <Select value={asStr(settings.translationEngine, "RealTrans Pro · v2")} options={TRANSLATION_ENGINES} onChange={v => onChange("translationEngine", v)} />
    </Row>
    <Row label="Latency budget" sub="Lower = faster but choppier on long passages.">
      <Select value={asStr(settings.latencyBudget, "280 ms · Balanced")} options={LATENCY_BUDGETS} onChange={v => onChange("latencyBudget", v)} />
    </Row>
  </div>
);

const RegionsPane = ({ pins, onUnpin, onPin }) => (
  <div>
    <SectionHeader title="Pinned regions" sub="Regions anchor a translation to a screen area and persist across sessions. Click “Pin new region” to draw one." />
    {(!pins || pins.length === 0) ? (
      <div style={{
        marginTop: 8, padding: "28px 16px", borderRadius: 10, textAlign: "center",
        background: "rgba(255,255,255,0.02)", border: "0.5px dashed var(--rt-line-2)",
        color: "var(--rt-fg-3)", fontSize: 12.5, lineHeight: 1.55,
      }}>
        No pinned regions yet.<br/>Pin one to keep translating the same spot on screen.
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {pins.map(r => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid var(--rt-line-2)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "rgba(139,124,255,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--rt-accent-bright)",
            }}>
              <Icon name="pin" size={14}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label || "Pinned region"}</div>
              <div style={{ fontSize: 10.5, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)" }}>
                {r.scenarioId || "—"} · {r.w}×{r.h} @ {r.x},{r.y}
              </div>
            </div>
            <button onClick={() => onUnpin(r.id)} title="Remove" style={{
              background: "transparent", border: "0.5px solid var(--rt-line-2)",
              color: "var(--rt-fg-3)", borderRadius: 6, cursor: "pointer",
              padding: "4px 8px", fontSize: 11,
            }}>Remove</button>
          </div>
        ))}
      </div>
    )}
    <button onClick={onPin} style={{
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

const ModesPane = ({ settings, onChange }) => {
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
        {modes.map(m => {
          const on = asBool(settings[`mode.${m.id}`], m.on);
          return (
            <div key={m.id} style={{
              padding: 14, borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid var(--rt-line-2)",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: on ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.04)",
                color: on ? "var(--rt-accent-bright)" : "var(--rt-fg-3)",
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
              <Toggle value={on} onChange={v => onChange(`mode.${m.id}`, v)}/>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AppearancePane = ({ settings, onChange, renderMode }) => {
  const active = asStr(settings.renderMode, renderMode || "replace");
  const styles = [["replace", "Replace"], ["ghost", "Ghost"], ["parallel", "Parallel"], ["card", "Card"]];
  return (
    <div>
      <SectionHeader title="Appearance" sub="How translations look when overlaid. Per-mode overrides live inside Modes." />
      <Row label="Overlay render style" sub="Replace = in-place. Ghost = layered. Parallel = adjacent. Card = consolidated.">
        <div style={{ display: "flex", gap: 4 }}>
          {styles.map(([id, label]) => {
            const sel = active === id;
            return (
              <div key={id} onClick={() => onChange("renderMode", id)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                background: sel ? "rgba(139,124,255,0.20)" : "rgba(255,255,255,0.05)",
                color: sel ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
                border: `0.5px solid ${sel ? "rgba(139,124,255,0.4)" : "var(--rt-line-2)"}`,
              }}>{label}</div>
            );
          })}
        </div>
      </Row>
      <Row label="Match source typography" sub="Mimic the font, color, and weight of the source where possible.">
        <Toggle value={asBool(settings.matchTypography, true)} onChange={v => onChange("matchTypography", v)}/>
      </Row>
      <Row label="Stabilize subtitles" sub="Wait for OCR to settle before swapping text (avoids flicker).">
        <Toggle value={asBool(settings.stabilizeSubtitles, true)} onChange={v => onChange("stabilizeSubtitles", v)}/>
      </Row>
      <Row label="Background opacity" sub="How visible the surrounding source is.">
        <Select value={asStr(settings.backgroundOpacity, "92%")} options={OPACITY_OPTS} onChange={v => onChange("backgroundOpacity", v)} />
      </Row>
      <Row label="Dim original on hover" sub="When mousing over a translated region, show the source.">
        <Toggle value={asBool(settings.dimOnHover, true)} onChange={v => onChange("dimOnHover", v)}/>
      </Row>
    </div>
  );
};

const HotkeysPane = ({ settings, onChange, onReassignHotkey }) => {
  const keys = [
    { id: "activate", name: "Activate RealTrans", def: ["Alt", "Q"], action: "openPalette" },
    { id: "translateWindow", name: "Translate active window", def: ["⌃", "⌥", "W"], action: "toggleOverlay" },
    { id: "togglePin", name: "Toggle pinned region", def: ["⌃", "⌥", "P"], action: null },
    { id: "cycleOverlay", name: "Cycle overlay style", def: ["⌃", "⌥", "O"], action: null },
    { id: "pause", name: "Pause translations", def: ["⌃", "⌥", "."], action: null },
    { id: "showOriginal", name: "Show original on hold", def: ["⌥"], action: null },
    { id: "palette", name: "Open command palette", def: ["Alt", "Q"], action: "openPalette" },
  ];
  const [capturing, setCapturing] = useState(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setCapturing(null); return; }
      if (["Shift", "Control", "Alt", "Meta", "OS"].includes(e.key)) return; // wait for a real key
      const mods = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Win");
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const row = keys.find(k => k.id === capturing);
      onChange(`hotkey.${capturing}`, [...mods, key].join("+"));
      if (row && row.action) onReassignHotkey(row.action, key, mods);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing]);

  const comboFor = (k) => {
    const stored = settings[`hotkey.${k.id}`];
    return stored ? String(stored).split("+") : k.def;
  };

  return (
    <div>
      <SectionHeader title="Hotkeys" sub="Click Rebind, then press the new combination. Global hotkeys (Activate / Translate window) take effect immediately." />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {keys.map(k => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", padding: "10px 4px", borderBottom: "0.5px solid var(--rt-line)" }}>
            <span style={{ flex: 1, fontSize: 12.5 }}>{k.name}</span>
            {capturing === k.id ? (
              <span style={{ fontSize: 11, color: "var(--rt-accent-bright)", fontFamily: "var(--rt-mono)" }}>Press keys… (Esc to cancel)</span>
            ) : (
              <div style={{ display: "flex", gap: 4 }}>
                {comboFor(k).map((x, i) => <span key={i} className="kbd">{x}</span>)}
              </div>
            )}
            <button onClick={() => setCapturing(k.id)} style={{ marginLeft: 12, background: "transparent", border: 0, color: capturing === k.id ? "var(--rt-accent-bright)" : "var(--rt-fg-3)", cursor: "pointer", fontSize: 11 }}>
              {capturing === k.id ? "Cancel" : "Rebind"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdvancedPane = ({ settings, onChange }) => {
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const doReset = () => {
    if (!resetting) { setResetting(true); return; }
    setResetting(false);
    setResetDone(true);
    onChange("glossaryResetAt", String(Date.now()));
  };

  return (
    <div>
      <SectionHeader title="Advanced" sub="Power-user controls. Default to off unless you know what you're doing." />
      <Row label="Glossary memory" sub="Remember preferred translations for specific proper nouns and phrases.">
        <Toggle value={asBool(settings.glossaryMemory, true)} onChange={v => onChange("glossaryMemory", v)}/>
      </Row>
      <Row label="Per-app voice" sub="Tone-match translation to genre (e.g. JRPGs get archaic English).">
        <Toggle value={asBool(settings.perAppVoice, true)} onChange={v => onChange("perAppVoice", v)}/>
      </Row>
      <Row label="Predictive translation" sub="Pre-translate the next likely line for live content (lower perceived latency).">
        <Toggle value={asBool(settings.predictive, false)} onChange={v => onChange("predictive", v)}/>
      </Row>
      <Row label="OBS bridge" sub="Stream translated captions to a virtual display source.">
        <Toggle value={asBool(settings.obsBridge, false)} onChange={v => onChange("obsBridge", v)}/>
      </Row>
      <Row label="Telemetry" sub="Anonymized usage that helps RealTrans learn region-detection patterns.">
        <Toggle value={asBool(settings.telemetry, false)} onChange={v => onChange("telemetry", v)}/>
      </Row>
      <Row label="Reset learned glossary" sub="Erase all per-app vocabulary memory.">
        <button onClick={doReset} disabled={resetDone} style={{
          padding: "4px 10px",
          border: `0.5px solid ${resetDone ? "var(--rt-line-2)" : "rgba(244,113,168,0.4)"}`,
          color: resetDone ? "var(--rt-fg-3)" : "#f471a8",
          background: resetDone ? "transparent" : "rgba(244,113,168,0.1)",
          borderRadius: 6, fontSize: 11, cursor: resetDone ? "default" : "pointer",
        }}>{resetDone ? "Cleared" : resetting ? "Click to confirm" : "Reset…"}</button>
      </Row>
    </div>
  );
};

Object.assign(window, { Settings });

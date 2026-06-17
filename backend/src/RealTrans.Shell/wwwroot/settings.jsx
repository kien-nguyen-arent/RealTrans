/* settings.jsx — RealTrans settings panel
   Drawer-style modal. Every control here is wired to the SAME state + IPC path as
   the control panel: language pair / translator / OCR engines round-trip through
   `settings:set` → `settings:state` (see SessionManager.OnSettingsSet), and the
   overlay style drives the shared renderMode. Tabs cover only what the backend
   actually supports today — no mock controls.

   The pickers (LanguageSwitcher / TranslatorPicker / OcrEnginePicker) and
   OVERLAY_STYLES are defined in control-panel.jsx, which RealTrans.html loads
   before this file.
*/

const Settings = ({
  open, onClose,
  sourceLang, targetLang, onLanguageChange,
  translator, onTranslatorChange,
  ocrEngines, onOcrEngineToggle,
  renderMode, onRenderMode,
  overlayActive,
}) => {
  const [tab, setTab] = useState("general");
  if (!open) return null;

  const tabs = [
    { id: "general",     label: "General",     icon: "settings" },
    { id: "recognition", label: "Recognition", icon: "eye"      },
    { id: "appearance",  label: "Appearance",  icon: "layers"   },
    { id: "hotkeys",     label: "Hotkeys",     icon: "keyboard" },
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
        zIndex: 81, width: 720, maxHeight: "84%",
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
          <div style={{ display: "flex", minHeight: 420, flex: 1, overflow: "hidden" }}>
            {/* sidebar */}
            <div style={{
              width: 170, padding: 8,
              borderRight: "0.5px solid var(--rt-line-2)",
              display: "flex", flexDirection: "column", gap: 1,
            }}>
              {tabs.map(t => (
                <SettingsTab key={t.id} {...t} active={tab === t.id} onClick={() => setTab(t.id)} />
              ))}
            </div>

            {/* content */}
            <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
              {tab === "general" && (
                <GeneralPane
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                  onLanguageChange={onLanguageChange}
                  translator={translator}
                  onTranslatorChange={onTranslatorChange}
                  overlayActive={overlayActive}
                />
              )}
              {tab === "recognition" && (
                <RecognitionPane
                  ocrEngines={ocrEngines}
                  onOcrEngineToggle={onOcrEngineToggle}
                  overlayActive={overlayActive}
                />
              )}
              {tab === "appearance" && (
                <AppearancePane renderMode={renderMode} onRenderMode={onRenderMode} />
              )}
              {tab === "hotkeys" && <HotkeysPane />}
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
  <div style={{ marginBottom: 14 }}>
    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h2>
    {sub && <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: "var(--rt-fg-3)", lineHeight: 1.5 }}>{sub}</p>}
  </div>
);

/* ── panes ────────────────────────────────────────────────────── */

// Language pair + translator. Reuses the exact ControlPanel controls, so a change
// here fires the same settings:set IPC and both surfaces stay in sync via the
// echoed settings:state.
const GeneralPane = ({ sourceLang, targetLang, onLanguageChange, translator, onTranslatorChange, overlayActive }) => (
  <div>
    <SectionHeader title="Language" sub="Source is read from the screen by OCR; target is what you read. Applies live." />
    <LanguageSwitcher sourceLang={sourceLang} targetLang={targetLang} onChange={onLanguageChange} />

    <div style={{ height: 22 }} />

    <SectionHeader
      title="Translator"
      sub={overlayActive ? "Stop translating to switch the engine." : "Service used to translate recognized text."}
    />
    <TranslatorPicker active={translator} onChange={onTranslatorChange} disabled={overlayActive} />
  </div>
);

// OCR engines. C# guarantees at least one stays enabled (re-enables WindowsOCR if
// you clear all) and echoes the corrected state back, so the optimistic toggle here
// self-reconciles.
const RecognitionPane = ({ ocrEngines, onOcrEngineToggle, overlayActive }) => (
  <div>
    <SectionHeader
      title="OCR engines"
      sub={overlayActive
        ? "Stop translating to change engines. At least one must stay enabled."
        : "At least one must stay enabled. WindowsOCR is built-in; Tesseract is bundled."}
    />
    <OcrEnginePicker engines={ocrEngines} onToggle={onOcrEngineToggle} disabled={overlayActive} />
  </div>
);

// Overlay render style — drives the shared renderMode (JS-side; the same control as
// the ControlPanel's "Overlay style").
const AppearancePane = ({ renderMode, onRenderMode }) => (
  <div>
    <SectionHeader title="Overlay style" sub="How translations are shown. Inline keeps them in this window; Replace and Ghost draw over the captured region." />
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {OVERLAY_STYLES.map(s => (
        <button
          key={s.id}
          onClick={() => onRenderMode(s.id)}
          className={`cp-overlay-btn${renderMode === s.id ? " active" : ""}`}
        >
          <Icon name={s.icon} size={12} />
          {s.label}
        </button>
      ))}
    </div>
  </div>
);

// The real global hotkeys handled by RealTransHotKeyManager + the JS key handler.
// Read-only: rebinding (hotkey:reassign) has no backend yet.
const REAL_HOTKEYS = [
  { name: "Open command palette",       keys: ["Alt", "Q"] },
  { name: "Toggle selection / overlay", keys: ["~"] },
  { name: "Dismiss topmost surface",    keys: ["Esc"] },
];

const HotkeysPane = () => (
  <div>
    <SectionHeader title="Hotkeys" sub="Global shortcuts handled by RealTrans. Rebinding isn't available yet." />
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {REAL_HOTKEYS.map(k => (
        <div key={k.name} style={{
          display: "flex", alignItems: "center",
          padding: "10px 4px", borderBottom: "0.5px solid var(--rt-line)",
        }}>
          <span style={{ flex: 1, fontSize: 12.5 }}>{k.name}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {k.keys.map((x, i) => <span key={i} className="kbd">{x}</span>)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, { Settings });

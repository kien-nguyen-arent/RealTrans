/* onboarding.jsx — first-run flow
   3 steps: welcome → languages & hotkey → try it.
   Glassy modal centered on the desktop.
*/

const Onboarding = ({ open, onClose }) => {
  const [step, setStep] = useState(0);
  const [src, setSrc] = useState("ja");
  const [dst, setDst] = useState("en");
  const [hotkey, setHotkey] = useState("AltQ");
  const { boxRef, startDrag, anchorStyle } = useDraggableModal(open);

  useEffect(() => { if (open) setStep(0); }, [open]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        zIndex: 70,
        animation: "rt-fade-in 0.2s var(--rt-ease) both",
      }}/>
      <div ref={boxRef} style={{
        position: "absolute", ...anchorStyle,
        zIndex: 71, width: 620,
      }}>
        <div className="glass-strong" style={{
          borderRadius: 18, padding: 0, overflow: "hidden",
          animation: "rt-pop-in 0.3s var(--rt-ease-2) both",
        }}>
          {/* progress strip — drag to move */}
          <div onMouseDown={startDrag} style={{ display: "flex", padding: "10px 14px 0", gap: 4, cursor: "move" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= step ? "var(--rt-accent-bright)" : "rgba(255,255,255,0.1)",
                transition: "background .2s var(--rt-ease)",
              }}/>
            ))}
          </div>

          <div style={{ padding: "28px 32px 24px", minHeight: 340 }}>
            {step === 0 && <OnbStep0 />}
            {step === 1 && <OnbStep1 src={src} setSrc={setSrc} dst={dst} setDst={setDst} hotkey={hotkey} setHotkey={setHotkey} />}
            {step === 2 && <OnbStep2 />}
          </div>

          {/* footer — also a drag handle (buttons excluded) */}
          <div onMouseDown={startDrag} style={{
            display: "flex", alignItems: "center",
            padding: "12px 18px", gap: 10,
            borderTop: "0.5px solid var(--rt-line-2)",
            background: "rgba(0,0,0,0.18)",
            cursor: "move", userSelect: "none",
          }}>
            <span style={{ fontSize: 10.5, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)" }}>
              {step + 1} / 3
            </span>
            <div style={{ flex: 1 }} />
            {step > 0 && <OnbBtn ghost onClick={() => setStep(step - 1)}>Back</OnbBtn>}
            {step < 2 && <OnbBtn primary onClick={() => setStep(step + 1)}>Continue</OnbBtn>}
            {step === 2 && <OnbBtn primary onClick={onClose}>Start translating</OnbBtn>}
          </div>
        </div>
      </div>
    </>
  );
};

const OnbBtn = ({ children, primary, ghost, onClick }) => (
  <button onClick={onClick} style={{
    padding: "8px 14px", border: 0, borderRadius: 8,
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    background: primary ? "var(--rt-accent)" : ghost ? "transparent" : "rgba(255,255,255,0.08)",
    color: primary ? "#fff" : "var(--rt-fg-2)",
    boxShadow: primary ? "0 4px 12px rgba(139,124,255,0.38)" : "none",
    letterSpacing: "-0.005em",
  }}>{children}</button>
);

const OnbStep0 = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <Wordmark size={26} />
    <div>
      <h2 style={{
        margin: 0, fontSize: 32, fontWeight: 600,
        letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--rt-fg)",
      }}>
        Translation that lives <em style={{ fontStyle: "normal", color: "var(--rt-accent-bright)" }}>on top of</em> your screen.
      </h2>
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, lineHeight: 1.6, color: "var(--rt-fg-2)" }}>
        RealTrans reads any text on your screen and lays the translation gently over the source — never a new window, never a context switch. It works on videos, games, manga, articles, and live calls.
      </p>
    </div>
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
      marginTop: 4,
    }}>
      <FeatureChip icon="crosshair" title="Smart selection" sub="Detects regions automatically"/>
      <FeatureChip icon="layers" title="Live overlays" sub="Replaces text in real time"/>
      <FeatureChip icon="memory" title="Glossary memory" sub="Learns from your context"/>
    </div>
  </div>
);

const FeatureChip = ({ icon, title, sub }) => (
  <div style={{
    padding: 12, borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "0.5px solid var(--rt-line-2)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--rt-accent-bright)", marginBottom: 6 }}>
      <Icon name={icon} size={13}/>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--rt-fg)" }}>{title}</span>
    </div>
    <div style={{ fontSize: 10.5, color: "var(--rt-fg-3)", lineHeight: 1.4 }}>{sub}</div>
  </div>
);

const OnbStep1 = ({ src, setSrc, dst, setDst, hotkey, setHotkey }) => {
  const langs = [
    { code: "ja", label: "日本語", sub: "Japanese" },
    { code: "ko", label: "한국어", sub: "Korean" },
    { code: "zh", label: "中文", sub: "Chinese" },
    { code: "auto", label: "Auto", sub: "Detect each time" },
  ];
  const dstLangs = [
    { code: "en", label: "English", sub: "English" },
    { code: "es", label: "Español", sub: "Spanish" },
    { code: "vi", label: "Tiếng Việt", sub: "Vietnamese" },
    { code: "fr", label: "Français", sub: "French" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--rt-fg)" }}>
          Pick your languages and shortcut.
        </h2>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--rt-fg-3)" }}>
          You can change all of this later. Auto-detect handles mixed-language content too.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <LangPicker label="From" langs={langs} value={src} onChange={setSrc} />
        <div style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(139,124,255,0.16)", color: "var(--rt-accent-bright)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="chevron-right" size={14}/>
        </div>
        <LangPicker label="To" langs={dstLangs} value={dst} onChange={setDst} />
      </div>

      <div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--rt-fg-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--rt-mono)", marginBottom: 8 }}>
          Activation shortcut
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "0.5px solid var(--rt-line-2)",
        }}>
          <Icon name="keyboard" size={15} />
          <span style={{ fontSize: 12.5, color: "var(--rt-fg)" }}>Press</span>
          <div style={{ display: "flex", gap: 4 }}>
            {hotkey.split(/(?=[A-Z⌃⌥⌘⇧↵])/).filter(Boolean).map((k, i) => (
              <span key={i} className="kbd" style={{ fontSize: 11.5, padding: "2px 8px", height: 22 }}>{k}</span>
            ))}
          </div>
          <span style={{ fontSize: 12.5, color: "var(--rt-fg-2)" }}>anywhere to activate.</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--rt-fg-3)" }}>Change in Settings → Hotkeys</span>
        </div>
      </div>
    </div>
  );
};

const LangPicker = ({ label, langs, value, onChange }) => (
  <div>
    <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--rt-fg-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--rt-mono)", marginBottom: 8 }}>
      {label}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {langs.map(l => (
        <div key={l.code} onClick={() => onChange(l.code)} style={{
          padding: "9px 12px", borderRadius: 8,
          background: value === l.code ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.04)",
          border: value === l.code ? "0.5px solid rgba(139,124,255,0.5)" : "0.5px solid var(--rt-line-2)",
          cursor: "pointer",
        }}>
          <div style={{ fontFamily: l.code === "ja" ? "var(--rt-jp)" : l.code === "ko" ? "system-ui" : "var(--rt-font)", fontSize: 13, fontWeight: 500, color: "var(--rt-fg)" }}>{l.label}</div>
          <div style={{ fontSize: 10.5, color: "var(--rt-fg-3)" }}>{l.sub}</div>
        </div>
      ))}
    </div>
  </div>
);

const OnbStep2 = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--rt-fg)" }}>
        Try it now.
      </h2>
      <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--rt-fg-3)" }}>
        Press your shortcut and draw a region. Or just hover any block of text — RealTrans will offer to translate it.
      </p>
    </div>

    {/* mini demo card */}
    <div style={{
      padding: 18, borderRadius: 12,
      background: "rgba(139,124,255,0.10)",
      border: "0.5px solid rgba(139,124,255,0.32)",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "linear-gradient(140deg, #8b7cff, #5d4ce0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 24px rgba(139,124,255,0.4)",
      }}>
        <Icon name="crosshair" size={26} stroke={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--rt-fg)" }}>Press to begin</div>
        <div style={{ fontSize: 11.5, color: "var(--rt-fg-3)", marginTop: 2 }}>
          Your shortcut works everywhere — even in fullscreen games and video.
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <span className="kbd" style={{ fontSize: 12, padding: "4px 8px", height: 26 }}>Alt</span>
        <span className="kbd" style={{ fontSize: 12, padding: "4px 8px", height: 26 }}>Q</span>
      </div>
    </div>

    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
    }}>
      <ModeCard icon="play" label="Anime mode" sub="Crunchyroll, Netflix, MPV"/>
      <ModeCard icon="manga" label="Manga mode" sub="MangaPlus, ComiXology, files"/>
      <ModeCard icon="joystick" label="Game mode" sub="FFXIV, BG3, Steam overlay"/>
    </div>
  </div>
);

const ModeCard = ({ icon, label, sub }) => (
  <div style={{
    padding: 10, borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "0.5px solid var(--rt-line-2)",
    display: "flex", alignItems: "center", gap: 9,
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 7,
      background: "rgba(255,255,255,0.05)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--rt-fg-2)",
    }}><Icon name={icon} size={14}/></div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--rt-fg)" }}>{label}</div>
      <div style={{ fontSize: 10, color: "var(--rt-fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
    </div>
  </div>
);

Object.assign(window, { Onboarding });

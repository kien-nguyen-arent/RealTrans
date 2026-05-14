/* desktop.jsx — Windows 11 desktop frame + taskbar
   Hosts whichever scenario is active. Includes the RealTrans
   menu-bar app and a hotkey hint.
*/

const Desktop = ({ scenario, scenarioId, children, onTaskbarTranslate, palettOpen, time }) => {
  return (
    <div className="desktop" style={{
      position: "relative", overflow: "hidden",
      background: "#0c0c10",
      color: "#fff",
      fontFamily: "var(--rt-font)",
    }}>
      {/* simulated wallpaper layer — barely visible at the edges */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(800px 600px at 80% 20%, rgba(75, 56, 156, 0.32), transparent 60%), radial-gradient(900px 500px at 10% 90%, rgba(50, 78, 142, 0.28), transparent 60%), linear-gradient(180deg, #0e1018 0%, #08090d 100%)",
      }} />

      {/* SCENE: window-chrome holding the actual scenario content */}
      <div style={{
        position: "absolute",
        left: "3.2%", top: "3.6%", right: "3.2%", bottom: "7.6%",
        borderRadius: 10,
        overflow: "hidden",
        background: "#16161c",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 30px 60px rgba(0,0,0,0.55)",
      }}>
        {/* window title bar */}
        <div style={{
          height: 36,
          background: "linear-gradient(180deg, rgba(28,28,34,0.95) 0%, rgba(22,22,28,0.95) 100%)",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", padding: "0 12px",
          fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: "-0.005em",
          gap: 10,
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "rgba(255,255,255,0.5)" }}>
            <WindowAppIcon scenarioId={scenarioId} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{getWindowTitle(scenarioId)}</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <WinBtn kind="min" />
            <WinBtn kind="max" />
            <WinBtn kind="close" />
          </div>
        </div>

        <div style={{ position: "relative", height: "calc(100% - 36px)" }}>
          {children}
        </div>
      </div>

      {/* TASKBAR (Windows 11) */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "5.6%",
        background: "rgba(20, 21, 28, 0.78)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderTop: "0.5px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        zIndex: 5,
      }}>
        {/* Left cluster: time & nothing else (Win11-like with centered icons) */}
        <div style={{ position: "absolute", left: 14, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
          <span style={{ fontFamily: "var(--rt-mono)" }}>{time}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>EN</span>
        </div>

        <TaskbarIcon glyph={<WinLogo />} />
        <TaskbarIcon glyph={<Icon name="search" size={15} />} />
        <TaskbarIcon glyph={<ScenarioGlyph id={scenarioId} active />} active />
        <TaskbarIcon glyph={<Icon name="layers" size={15} />} />
        <TaskbarIcon
          glyph={<Wordmark size={15} withText={false} />}
          active={palettOpen}
          onClick={onTaskbarTranslate}
          ringAccent
          tooltip="RealTrans · ⌃⌥Space"
        />

        {/* Right cluster: tray */}
        <div style={{ position: "absolute", right: 12, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.55)", fontSize: 10.5 }}>
          <Icon name="globe" size={13} />
          <Icon name="mic" size={13} />
          <span className="mono">{time}</span>
        </div>
      </div>

      {/* RT menubar pulse hint — only when idle */}
    </div>
  );
};

const WinBtn = ({ kind }) => {
  const glyph = kind === "min" ? "─" : kind === "max" ? "□" : "✕";
  return (
    <div style={{
      width: 28, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, color: "rgba(255,255,255,0.5)",
      borderRadius: 4,
    }}>{glyph}</div>
  );
};

const TaskbarIcon = ({ glyph, active, ringAccent, onClick, tooltip }) => {
  return (
    <div onClick={onClick} title={tooltip} style={{
      position: "relative",
      width: 36, height: 36, borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.78)",
      background: active ? "rgba(255,255,255,0.08)" : "transparent",
      cursor: onClick ? "pointer" : "default",
      transition: "background .15s var(--rt-ease)",
      outline: ringAccent ? "1px solid rgba(139,124,255,0.32)" : "none",
      boxShadow: ringAccent ? "0 0 0 4px rgba(139,124,255,0.08), 0 0 18px rgba(139,124,255,0.32)" : undefined,
    }}>
      {glyph}
      {active && <span style={{
        position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)",
        width: 14, height: 2, borderRadius: 2,
        background: ringAccent ? "var(--rt-accent-bright)" : "rgba(255,255,255,0.55)",
      }}/>}
    </div>
  );
};

const WinLogo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="9" height="9" fill="#60a5fa"/>
    <rect x="13" y="2" width="9" height="9" fill="#60a5fa"/>
    <rect x="2" y="13" width="9" height="9" fill="#60a5fa"/>
    <rect x="13" y="13" width="9" height="9" fill="#60a5fa"/>
  </svg>
);

const ScenarioGlyph = ({ id, active }) => {
  const map = {
    browser: <BrowserGlyph />,
    anime: <Icon name="play" size={15} />,
    game: <Icon name="joystick" size={15} />,
    manga: <Icon name="manga" size={15} />,
    meeting: <Icon name="video" size={15} />,
  };
  return map[id] || <Icon name="browser" size={15} />;
};

const BrowserGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6"/>
    <path d="M2 12h20M12 2c3 4 3 16 0 20M12 2c-3 4-3 16 0 20" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4"/>
  </svg>
);

const WindowAppIcon = ({ scenarioId }) => {
  const map = {
    browser: <BrowserGlyph />,
    anime: <Icon name="play" size={14} />,
    game: <Icon name="joystick" size={14} />,
    manga: <Icon name="manga" size={14} />,
    meeting: <Icon name="video" size={14} />,
  };
  return <span style={{ display: "inline-flex", color: "rgba(255,255,255,0.7)" }}>{map[scenarioId]}</span>;
};

const getWindowTitle = (id) => {
  switch (id) {
    case "browser": return "Microsoft Edge — ITmedia News";
    case "anime": return "Crunchyroll · Yoru no Tegami — Ep. 04";
    case "game": return "Final Quest VII · Steam";
    case "manga": return "MangaPlus Reader — Vol. 12 ch. 087";
    case "meeting": return "Meet · Design Sync";
    default: return "Application";
  }
};

Object.assign(window, { Desktop });

/* control-panel.jsx — Production control panel + translation feed.
   Two components served from a single file:
     ControlPanel    — left sidebar: mode, overlay style, start/stop.
     TranslationFeed — right area: live translation results.
*/

/* ── Mode + overlay-style data ──────────────────────────────────── */
const MODES = [
  { id: "anime",   label: "Anime / Video",  sub: "Hardcoded subtitles",   icon: "play"     },
  { id: "browser", label: "Browser",         sub: "Foreign-language pages", icon: "browser"  },
  { id: "game",    label: "Game",            sub: "JRPG dialogue & menus",  icon: "joystick" },
  { id: "manga",   label: "Manga",           sub: "Speech bubbles",         icon: "manga"    },
  { id: "meeting", label: "Meeting",         sub: "Live captions",          icon: "video"    },
];

const OVERLAY_STYLES = [
  { id: "replace",  label: "Replace",  icon: "wand"   },
  { id: "ghost",    label: "Ghost",    icon: "eye"    },
  { id: "parallel", label: "Parallel", icon: "layers" },
  { id: "card",     label: "Card",     icon: "stack"  },
];

/* ── ControlPanel ────────────────────────────────────────────────── */
const ControlPanel = ({
  scenarioId, onScenario,
  renderMode, onRenderMode,
  overlayActive, selecting,
  onStart, onStop,
  onPalette, onSettings, onOnboarding, onNotes,
}) => (
  <div className="cp-root">

    {/* ── Header ── */}
    <div className="cp-header">
      <Wordmark size={18} />
      <div style={{ flex: 1 }} />
      <button className="cp-icon-btn" onClick={onSettings} title="Settings">
        <Icon name="settings" size={15} />
      </button>
    </div>

    {/* ── Scrollable content ── */}
    <div className="cp-scroll">

      {/* ── Mode selector ── */}
      <div className="cp-section">
        <div className="cp-label">Mode</div>
        <div className="cp-mode-list">
          {MODES.map(m => (
            <ModeRow
              key={m.id}
              mode={m}
              active={scenarioId === m.id}
              disabled={overlayActive}
              onClick={() => onScenario(m.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Overlay style ── */}
      <div className="cp-section">
        <div className="cp-label">Overlay style</div>
        <div className="cp-overlay-grid">
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

    </div>

    {/* ── Quick links ── */}
    <div className="cp-links">
      <button className="cp-link-btn" onClick={onPalette}>
        <Icon name="command" size={13} />
        <span style={{ flex: 1 }}>Command palette</span>
        <span className="cp-kbds">
          <span className="kbd">Alt</span>
          <span className="kbd">Q</span>
        </span>
      </button>
      <button className="cp-link-btn" onClick={onOnboarding}>
        <Icon name="sparkle" size={13} />
        Getting started
      </button>
      <button className="cp-link-btn" onClick={onNotes}>
        <Icon name="notes" size={13} />
        Release notes
      </button>
    </div>

    {/* ── CTA ── */}
    <div className="cp-cta">
      {overlayActive ? (
        <button className="cp-btn cp-btn-stop" onClick={onStop}>
          <span className="cp-stop-sq" />
          Stop translating
        </button>
      ) : selecting ? (
        <button className="cp-btn cp-btn-start" disabled style={{ opacity: 0.65, cursor: "default" }}>
          <ThinkingDots />
          Selecting region…
        </button>
      ) : (
        <button className="cp-btn cp-btn-start" onClick={onStart}>
          <Icon name="crosshair" size={15} />
          Start translating
        </button>
      )}
    </div>

  </div>
);

const ModeRow = ({ mode, active, disabled, onClick }) => (
  <button
    onClick={disabled ? undefined : onClick}
    className={`cp-mode-row${active ? " active" : ""}${disabled ? " disabled" : ""}`}
  >
    <span className="cp-mode-ico">
      <Icon name={mode.icon} size={14} />
    </span>
    <span className="cp-mode-txt">
      <span className="cp-mode-name">{mode.label}</span>
      <span className="cp-mode-sub">{mode.sub}</span>
    </span>
    {active && (
      <span className="cp-mode-check">
        <Icon name="check" size={12} />
      </span>
    )}
  </button>
);

/* ── TranslationFeed ─────────────────────────────────────────────── */
const TranslationFeed = ({ overlayActive, feed, renderMode }) => {
  const feedRef = useRef(null);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed.length]);

  if (!overlayActive && feed.length === 0) return <FeedEmpty />;

  const modeLabel = OVERLAY_STYLES.find(s => s.id === renderMode)?.label ?? renderMode;

  return (
    <div className="tf-root">
      {/* Status bar */}
      <div className="tf-bar">
        <div className="tf-status">
          <span className={`tf-dot${overlayActive ? " live" : ""}`} />
          {overlayActive ? (
            <>
              <span>Translating</span>
              <Pill mono accent style={{ marginLeft: 6 }}>{modeLabel}</Pill>
            </>
          ) : (
            <span style={{ color: "var(--rt-fg-3)" }}>Stopped</span>
          )}
        </div>
        <span style={{ fontFamily: "var(--rt-mono)", fontSize: 10.5, color: "var(--rt-fg-3)" }}>
          JA → EN
        </span>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="tf-feed">
        {overlayActive && feed.length === 0 && (
          <div className="tf-waiting">
            <ThinkingDots />
            <span>Waiting for text…</span>
          </div>
        )}
        {feed.map((item, i) => <FeedItem key={i} item={item} />)}
      </div>
    </div>
  );
};

const FeedItem = ({ item }) => (
  <div className="tf-item">
    <div className="tf-src">{item.sourceText}</div>
    <div className="tf-arrow">↓</div>
    <div className="tf-dst">{item.translatedText}</div>
    <div className="tf-meta">
      <span>{item.elapsedMs} ms</span>
      {item.regionId && <span>· {item.regionId}</span>}
    </div>
  </div>
);

const FeedEmpty = () => (
  <div className="tf-empty">
    <div className="tf-empty-icon">
      <Icon name="crosshair" size={28} />
    </div>
    <div className="tf-empty-title">Ready to translate</div>
    <p className="tf-empty-body">
      Pick a mode on the left, then click <strong>Start translating</strong> to
      select the region of your screen to translate.
    </p>
    <div className="tf-empty-hint">
      Press{" "}
      <span className="kbd">Alt</span>
      <span className="kbd">Q</span>
      {" "}for the command palette
    </div>
  </div>
);

Object.assign(window, { ControlPanel, TranslationFeed });

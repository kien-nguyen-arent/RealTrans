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
  // Inline is the default: no screen overlay, results render in the app's
  // right pane split into Original (top) and Translated (bottom). Great for
  // debugging — you see exactly what OCR is reading and what's being translated.
  { id: "inline",   label: "Inline",   icon: "layers" },
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

// Returns true if an error item belongs in the Original half (OCR/capture/language).
// Anything else (translator failures, network, generic pipeline) goes in Translated.
const isOriginalError = (item) =>
  item.kind === "error" && /^(ocr|capture|language|no-ocr)/i.test(item.code || "");

const TranslationFeed = ({ overlayActive, feed, renderMode, latestPreview }) => {
  if (renderMode === "inline") {
    return (
      <InlineTranslationFeed
        overlayActive={overlayActive}
        feed={feed}
        latestPreview={latestPreview}
      />
    );
  }
  return <SingleListTranslationFeed overlayActive={overlayActive} feed={feed} renderMode={renderMode} />;
};

/* Inline mode — Original (top) / Translated (bottom) split. */
const InlineTranslationFeed = ({ overlayActive, feed, latestPreview }) => {
  const origRef  = useRef(null);
  const transRef = useRef(null);

  // Split the feed into the two halves.
  const originalItems = feed.filter(
    it => it.kind === "translation" || isOriginalError(it)
  );
  const translatedItems = feed.filter(
    it =>
      it.kind === "translation" ||
      it.kind === "status" ||
      (it.kind === "error" && !isOriginalError(it))
  );

  // Auto-scroll both panes when items arrive.
  useEffect(() => {
    if (origRef.current)  origRef.current.scrollTop  = origRef.current.scrollHeight;
    if (transRef.current) transRef.current.scrollTop = transRef.current.scrollHeight;
  }, [feed.length, latestPreview?.at]);

  if (!overlayActive && feed.length === 0 && !latestPreview) return <FeedEmpty />;

  return (
    <div className="tf-root" style={{ display: "flex", flexDirection: "column" }}>
      {/* Status bar */}
      <div className="tf-bar">
        <div className="tf-status">
          <span className={`tf-dot${overlayActive ? " live" : ""}`} />
          {overlayActive ? (
            <>
              <span>Translating</span>
              <Pill mono accent style={{ marginLeft: 6 }}>Inline</Pill>
            </>
          ) : (
            <span style={{ color: "var(--rt-fg-3)" }}>Stopped</span>
          )}
        </div>
        <span style={{ fontFamily: "var(--rt-mono)", fontSize: 10.5, color: "var(--rt-fg-3)" }}>
          JA → EN
        </span>
      </div>

      {/* Original half */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        minHeight: 0,
        borderBottom: "0.5px solid var(--rt-line-2)",
      }}>
        <PaneHeader label="Original" sub="What OCR is reading" />
        <div ref={origRef} className="tf-feed" style={{ flex: 1, minHeight: 0 }}>
          {originalItems.length === 0 && !latestPreview && overlayActive && (
            <div className="tf-waiting">
              <ThinkingDots />
              <span>Listening for text…</span>
            </div>
          )}
          {originalItems.map((item, i) => (
            <OriginalFeedItem key={`o${i}`} item={item} />
          ))}
          {latestPreview && (
            <LivePreviewRow text={latestPreview.text} />
          )}
        </div>
      </div>

      {/* Translated half */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <PaneHeader label="Translated" sub="What the translator returns" />
        <div ref={transRef} className="tf-feed" style={{ flex: 1, minHeight: 0 }}>
          {translatedItems.length === 0 && overlayActive && (
            <div className="tf-waiting">
              <ThinkingDots />
              <span>Waiting for text…</span>
            </div>
          )}
          {translatedItems.map((item, i) => (
            <TranslatedFeedItem key={`t${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};

/* Original feed row variants */
const OriginalFeedItem = ({ item }) => {
  if (item.kind === "error") {
    return <ErrorRow code={item.code} message={item.message} />;
  }
  // translation — show only the source text on the Original side
  return (
    <div className="tf-item">
      <div className="tf-src" style={{ fontSize: 14 }}>{item.sourceText}</div>
      <div className="tf-meta">
        {item.regionId && <span>· {item.regionId}</span>}
      </div>
    </div>
  );
};

/* Translated feed row variants */
const TranslatedFeedItem = ({ item }) => {
  if (item.kind === "status") {
    return (
      <div className="tf-item tf-item-status" style={{ opacity: 0.7 }}>
        <div style={{
          fontFamily: "var(--rt-mono)",
          fontSize: 11.5,
          color: "var(--rt-fg-3)",
        }}>
          {item.text}
        </div>
      </div>
    );
  }
  if (item.kind === "error") {
    return <ErrorRow code={item.code} message={item.message} />;
  }
  // translation — show only the translated text + latency on the Translated side
  return (
    <div className="tf-item">
      <div className="tf-dst" style={{ fontSize: 14 }}>{item.translatedText}</div>
      <div className="tf-meta">
        <span>{item.elapsedMs} ms</span>
      </div>
    </div>
  );
};

const PaneHeader = ({ label, sub }) => (
  <div style={{
    padding: "8px 14px 6px",
    borderBottom: "0.5px solid var(--rt-line)",
    display: "flex", alignItems: "baseline", gap: 8,
    flex: "0 0 auto",
  }}>
    <span style={{
      fontFamily: "var(--rt-mono)", fontSize: 10.5, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--rt-fg-2)",
    }}>{label}</span>
    <span style={{ fontSize: 11, color: "var(--rt-fg-3)" }}>{sub}</span>
  </div>
);

// Latest OCR preview — distinct from history rows (slightly transparent, blinking
// border) so the user can tell it's the live cursor of what OCR is currently
// reading, not a committed result.
const LivePreviewRow = ({ text }) => (
  <div className="tf-item" style={{
    border: "0.5px dashed rgba(139,124,255,0.45)",
    background: "rgba(139,124,255,0.04)",
    opacity: 0.92,
  }}>
    <div style={{
      fontFamily: "var(--rt-mono)",
      fontSize: 10, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--rt-accent-bright)",
      marginBottom: 4,
    }}>Live OCR</div>
    <div className="tf-src" style={{ fontSize: 13.5 }}>{text || "(no characters detected)"}</div>
  </div>
);

const ErrorRow = ({ code, message }) => (
  <div className="tf-item tf-item-error">
    <div style={{
      fontFamily: "var(--rt-mono)",
      fontSize: 10.5,
      color: "var(--rt-rose)",
      letterSpacing: "0.02em",
    }}>
      [{code}]
    </div>
    <div style={{
      fontSize: 12.5,
      color: "var(--rt-fg-2)",
      lineHeight: 1.5,
      marginTop: 4,
    }}>
      {message}
    </div>
  </div>
);

/* Single-list mode — used by Replace/Ghost/Parallel/Card render modes. */
const SingleListTranslationFeed = ({ overlayActive, feed, renderMode }) => {
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed.length]);

  if (!overlayActive && feed.length === 0) return <FeedEmpty />;

  const modeLabel = OVERLAY_STYLES.find(s => s.id === renderMode)?.label ?? renderMode;

  return (
    <div className="tf-root">
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

const FeedItem = ({ item }) => {
  // Status rows (Translation started/finished, etc.) — muted, no arrow.
  if (item.kind === "status") {
    return (
      <div className="tf-item tf-item-status" style={{ opacity: 0.7 }}>
        <div className="tf-status-text" style={{
          fontFamily: "var(--rt-mono)",
          fontSize: 11.5,
          color: "var(--rt-fg-3)",
        }}>
          {item.text}
        </div>
      </div>
    );
  }

  // Error rows — accent color, no arrow, code prefix.
  if (item.kind === "error") {
    return (
      <div className="tf-item tf-item-error">
        <div className="tf-error-code" style={{
          fontFamily: "var(--rt-mono)",
          fontSize: 10.5,
          color: "var(--rt-rose)",
          letterSpacing: "0.02em",
        }}>
          [{item.code}]
        </div>
        <div className="tf-error-msg" style={{
          fontSize: 12.5,
          color: "var(--rt-fg-2)",
          lineHeight: 1.5,
          marginTop: 4,
        }}>
          {item.message}
        </div>
      </div>
    );
  }

  // Translation row — original look.
  return (
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
};

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

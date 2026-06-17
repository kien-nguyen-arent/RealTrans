/* control-panel.jsx — Production control panel + translation feed.
   Two components served from a single file:
     ControlPanel    — left sidebar: mode, overlay style, start/stop.
     TranslationFeed — right area: live translation results.
*/

/* ── Overlay-style data ──────────────────────────────────────────── */
// Per-content "Modes" (anime / browser / game / manga / meeting) used to live
// here, but the production pipeline treats every captured region the same — the
// mode was never wired to any behavior. It's been replaced by a "coming soon"
// placeholder in the panel until smart per-content tuning actually ships.
const OVERLAY_STYLES = [
  // Inline is the default: no screen overlay, results render in the app's
  // right pane split into Original (top) and Translated (bottom). Great for
  // debugging — you see exactly what OCR is reading and what's being translated.
  { id: "inline",   label: "Inline",   icon: "layers" },
  // Replace / Ghost draw over the captured screen region via the C# overlay
  // windows (OverlayManager → ReplaceOverlayWindow / GhostOverlayWindow).
  { id: "replace",  label: "Replace",  icon: "wand"   },
  { id: "ghost",    label: "Ghost",    icon: "eye"    },
];

// Language options. `id` matches the Translumo.Infrastructure.Language.Languages
// enum NAME (parsed by C# via Enum.TryParse) so settings:set IPC round-trips cleanly.
// `code` is the BCP-47-ish two-letter code shown in the chip.
//
// SOURCE list is restricted to languages with a Windows OCR engine. Others
// (TranslationOnly in the legacy LanguageDescriptorFactory) can't be used as the
// OCR input even if the translator supports them.
const SOURCE_LANGUAGES = [
  { id: "English",  code: "EN", label: "English"  },
  { id: "Japanese", code: "JA", label: "Japanese" },
  { id: "Chinese",  code: "ZH", label: "Chinese"  },
  { id: "Korean",   code: "KO", label: "Korean"   },
  { id: "Russian",  code: "RU", label: "Russian"  },
];

// TARGET list is broader since translators support more output languages than
// OCR can recognize. Curated to common pairs; users wanting more can ask.
const TARGET_LANGUAGES = [
  { id: "Vietnamese", code: "VI", label: "Vietnamese" },
  { id: "English",    code: "EN", label: "English"    },
  { id: "Japanese",   code: "JA", label: "Japanese"   },
  { id: "Chinese",    code: "ZH", label: "Chinese"    },
  { id: "Korean",     code: "KO", label: "Korean"     },
  { id: "French",     code: "FR", label: "French"     },
  { id: "German",     code: "DE", label: "German"     },
  { id: "Spanish",    code: "ES", label: "Spanish"    },
  { id: "Italian",    code: "IT", label: "Italian"    },
  { id: "Portuguese", code: "PT", label: "Portuguese" },
  { id: "Indonesian", code: "ID", label: "Indonesian" },
  { id: "Thai",       code: "TH", label: "Thai"       },
  { id: "Russian",    code: "RU", label: "Russian"    },
];

const langCode = (id, table) => table.find(l => l.id === id)?.code ?? id.slice(0, 2).toUpperCase();

/* ── OCR engines + Translator option tables ─────────────────────── */
// `id` must match the OCR config class name prefix on the C# side (see
// SessionManager.OnSettingsSet switch). `recommended` flagging marks the
// engine that ships out of the box on Windows 10+ without any extra install.
const OCR_ENGINES = [
  { id: "WindowsOCR", label: "Windows OCR", note: "Built-in", recommended: true },
  { id: "Tesseract",  label: "Tesseract",   note: "Open source · bundled" },
  // EasyOCR requires an embedded Python 3.8 distribution which we don't ship.
  // The C# side rejects toggling this on with an `easyocr-unavailable` error;
  // disabling the row in the UI prevents that round-trip in the first place.
  { id: "EasyOCR",    label: "EasyOCR",     note: "Python · not bundled in this build", disabled: true },
];

// `id` matches the Translators enum NAME on the C# side. Recommended free
// default is Google — works without API keys, supports the most languages.
const TRANSLATORS = [
  { id: "Google", label: "Google", note: "Free · widest language coverage", recommended: true },
  { id: "Deepl",  label: "DeepL",  note: "Higher quality · no Vietnamese/Thai" },
  { id: "Yandex", label: "Yandex", note: "Free · session-based" },
  { id: "Papago", label: "Papago", note: "Naver · KO-focused" },
];

/* ── ControlPanel ────────────────────────────────────────────────── */
const ControlPanel = ({
  renderMode, onRenderMode,
  overlayActive, selecting,
  sourceLang, targetLang, onLanguageChange,
  translator, onTranslatorChange,
  ocrEngines, onOcrEngineToggle,
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

      {/* ── Translate (language pair) ── */}
      <div className="cp-section">
        <div className="cp-label">Translate</div>
        <LanguageSwitcher
          sourceLang={sourceLang}
          targetLang={targetLang}
          onChange={onLanguageChange}
        />
      </div>

      {/* ── OCR engines (at least one must be enabled) ── */}
      <div className="cp-section">
        <div className="cp-label">OCR engines</div>
        <OcrEnginePicker
          engines={ocrEngines}
          onToggle={onOcrEngineToggle}
          disabled={overlayActive}
        />
      </div>

      {/* ── Translator backend ── */}
      <div className="cp-section">
        <div className="cp-label">Translator</div>
        <TranslatorPicker
          active={translator}
          onChange={onTranslatorChange}
          disabled={overlayActive}
        />
      </div>

      {/* ── Mode (future feature) ── */}
      <div className="cp-section">
        <div className="cp-label">Mode</div>
        <div className="cp-mode-soon">
          <span className="cp-mode-soon-ico">
            <Icon name="sparkle" size={14} />
          </span>
          <span className="cp-mode-soon-txt">
            <span className="cp-mode-soon-title">Smart modes coming soon</span>
            <span className="cp-mode-soon-sub">
              Per-content tuning for anime, manga, games and more is in development.
            </span>
          </span>
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

/* ── OcrEnginePicker ─────────────────────────────────────────────── */
// Multi-select toggle rows for the three legacy OCR engines. C# enforces that
// at least one stays enabled (re-enables WindowsOCR if the user clears all)
// and echoes the corrected state back via settings:state, so the optimistic
// UI updates here get reconciled if the user tries to disable everything.
const OcrEnginePicker = ({ engines, onToggle, disabled }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {OCR_ENGINES.map(eng => {
      const on = !!engines?.[eng.id];
      // Two distinct disabled states: `disabled` (session running — temporary,
      // resumes when session stops) vs `eng.disabled` (permanent — engine
      // isn't shippable in this build). The latter shows a "Unavailable" hint.
      const sessionLocked = disabled;
      const engineUnavailable = !!eng.disabled;
      const inert = sessionLocked || engineUnavailable;
      return (
        <button
          key={eng.id}
          onClick={inert ? undefined : () => onToggle(eng.id, !on)}
          disabled={inert}
          title={engineUnavailable ? "Unavailable in this build" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px",
            background: on ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.03)",
            border: `0.5px solid ${on ? "var(--rt-line-hi)" : "var(--rt-line-2)"}`,
            borderRadius: 7,
            color: "var(--rt-fg)",
            cursor: inert ? (engineUnavailable ? "not-allowed" : "default") : "pointer",
            textAlign: "left",
            opacity: engineUnavailable ? 0.4 : (sessionLocked ? 0.5 : 1),
          }}
        >
          <span style={{
            width: 14, height: 14, borderRadius: 4,
            background: on ? "var(--rt-accent)" : "transparent",
            border: `1px solid ${on ? "var(--rt-accent)" : "var(--rt-line-hi)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
            flex: "0 0 auto",
          }}>
            {on && <Icon name="check" size={10} />}
          </span>
          <span style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{
              fontSize: 12.5, fontWeight: 500,
              color: on ? "var(--rt-fg)" : "var(--rt-fg-2)",
            }}>
              {eng.label}
              {eng.recommended && (
                <span style={{
                  marginLeft: 6,
                  fontFamily: "var(--rt-mono)", fontSize: 9,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--rt-accent-bright)",
                }}>recommended</span>
              )}
              {engineUnavailable && (
                <span style={{
                  marginLeft: 6,
                  fontFamily: "var(--rt-mono)", fontSize: 9,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--rt-fg-3)",
                }}>unavailable</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--rt-fg-3)", marginTop: 1 }}>
              {eng.note}
            </span>
          </span>
        </button>
      );
    })}
  </div>
);

/* ── TranslatorPicker ────────────────────────────────────────────── */
// Single-select radio list for the backend translator. Mid-session changes
// take effect immediately — the legacy TranslationProcessingService recreates
// its ITranslator on TranslationConfiguration.Translator property-change.
const TranslatorPicker = ({ active, onChange, disabled }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {TRANSLATORS.map(t => {
      const on = active === t.id;
      return (
        <button
          key={t.id}
          onClick={disabled ? undefined : () => onChange(t.id)}
          disabled={disabled}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px",
            background: on ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.03)",
            border: `0.5px solid ${on ? "var(--rt-line-hi)" : "var(--rt-line-2)"}`,
            borderRadius: 7,
            color: "var(--rt-fg)",
            cursor: disabled ? "default" : "pointer",
            textAlign: "left",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span style={{
            width: 14, height: 14, borderRadius: 999,
            background: on ? "var(--rt-accent)" : "transparent",
            border: `1px solid ${on ? "var(--rt-accent)" : "var(--rt-line-hi)"}`,
            boxShadow: on ? "inset 0 0 0 3px var(--rt-bg-2)" : "none",
            flex: "0 0 auto",
          }} />
          <span style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{
              fontSize: 12.5, fontWeight: 500,
              color: on ? "var(--rt-fg)" : "var(--rt-fg-2)",
            }}>
              {t.label}
              {t.recommended && (
                <span style={{
                  marginLeft: 6,
                  fontFamily: "var(--rt-mono)", fontSize: 9,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--rt-accent-bright)",
                }}>recommended</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--rt-fg-3)", marginTop: 1 }}>
              {t.note}
            </span>
          </span>
        </button>
      );
    })}
  </div>
);

/* ── LanguageSwitcher ────────────────────────────────────────────── */
// Compact pill showing the current source → target language pair. Click to
// open an inline panel with two scrollable lists. Selecting a language in
// either column fires `onChange({from, to})` synchronously — the parent then
// sends settings:set to C# so the legacy pipeline rebuilds engines + translator
// for the new pair without restarting the session.
const LanguageSwitcher = ({ sourceLang, targetLang, onChange }) => {
  const [open, setOpen] = useState(false);
  const fromCode = langCode(sourceLang, SOURCE_LANGUAGES);
  const toCode   = langCode(targetLang, TARGET_LANGUAGES);

  const swap = () => {
    // Only swap if the current source is also a valid target (always true for
    // our curated lists) AND the current target is a valid OCR source.
    const swappable = SOURCE_LANGUAGES.some(l => l.id === targetLang);
    if (swappable) {
      onChange({ from: targetLang, to: sourceLang });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="cp-link-btn"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px",
          background: open ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.04)",
          border: `0.5px solid ${open ? "var(--rt-line-hi)" : "var(--rt-line-2)"}`,
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        <Icon name="layers" size={13} />
        <span style={{
          fontFamily: "var(--rt-mono)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "var(--rt-fg)",
        }}>
          {fromCode} → {toCode}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); swap(); }}
          title="Swap source ↔ target"
          style={{
            marginLeft: "auto",
            padding: "2px 6px",
            borderRadius: 4,
            color: "var(--rt-fg-3)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >⇄</span>
      </button>

      {open && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          padding: 8,
          background: "var(--rt-bg-2)",
          border: "0.5px solid var(--rt-line-2)",
          borderRadius: 8,
          animation: "rt-fade-in 0.18s var(--rt-ease) both",
        }}>
          <LangColumn
            heading="From"
            options={SOURCE_LANGUAGES}
            selected={sourceLang}
            onPick={(id) => onChange({ from: id })}
          />
          <LangColumn
            heading="To"
            options={TARGET_LANGUAGES}
            selected={targetLang}
            onPick={(id) => onChange({ to: id })}
          />
        </div>
      )}
    </div>
  );
};

const LangColumn = ({ heading, options, selected, onPick }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <div style={{
      fontFamily: "var(--rt-mono)",
      fontSize: 9.5,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--rt-fg-3)",
      padding: "4px 6px 6px",
    }}>{heading}</div>
    <div style={{
      display: "flex", flexDirection: "column", gap: 1,
      maxHeight: 220, overflowY: "auto",
    }}>
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onPick(o.id)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px",
            background: selected === o.id ? "rgba(139,124,255,0.20)" : "transparent",
            color: selected === o.id ? "var(--rt-fg)" : "var(--rt-fg-2)",
            border: 0,
            borderRadius: 5,
            cursor: "pointer",
            fontSize: 12,
            textAlign: "left",
            width: "100%",
          }}
        >
          <span style={{
            fontFamily: "var(--rt-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: selected === o.id ? "var(--rt-accent-bright)" : "var(--rt-fg-3)",
            minWidth: 22,
          }}>{o.code}</span>
          <span>{o.label}</span>
          {selected === o.id && (
            <span style={{ marginLeft: "auto", color: "var(--rt-accent-bright)" }}>
              <Icon name="check" size={11} />
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
);

/* ── TranslationFeed ─────────────────────────────────────────────── */

// Returns true if an error item belongs in the Original half (OCR/capture/language).
// Anything else (translator failures, network, generic pipeline) goes in Translated.
const isOriginalError = (item) =>
  item.kind === "error" && /^(ocr|capture|language|no-ocr)/i.test(item.code || "");

const TranslationFeed = ({ overlayActive, feed, renderMode, sourceLang, targetLang, latestPreview, latestTick, latestThumbnail }) => {
  if (renderMode === "inline") {
    return (
      <InlineTranslationFeed
        overlayActive={overlayActive}
        feed={feed}
        sourceLang={sourceLang}
        targetLang={targetLang}
        latestPreview={latestPreview}
        latestTick={latestTick}
        latestThumbnail={latestThumbnail}
      />
    );
  }
  return <SingleListTranslationFeed
    overlayActive={overlayActive}
    feed={feed}
    renderMode={renderMode}
    sourceLang={sourceLang}
    targetLang={targetLang}
  />;
};

/* Inline mode — Original (top) / Translated (bottom) split. */
const InlineTranslationFeed = ({ overlayActive, feed, sourceLang, targetLang, latestPreview, latestTick, latestThumbnail }) => {
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
  }, [feed.length, latestPreview?.at, latestTick?.at]);

  if (!overlayActive && feed.length === 0 && !latestPreview && !latestTick && !latestThumbnail) return <FeedEmpty />;

  const langLabel = `${langCode(sourceLang, SOURCE_LANGUAGES)} → ${langCode(targetLang, TARGET_LANGUAGES)}`;

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
          {langLabel}
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

        {/* Pinned diagnostics: thumbnail + telemetry. Visible whenever a
            session is running so the user can confirm capture + OCR at a
            glance, even when no translation has landed yet. */}
        {latestThumbnail && <CaptureThumbnail thumb={latestThumbnail} />}
        {latestTick && <OcrTelemetryRow tick={latestTick} />}

        <div ref={origRef} className="tf-feed" style={{ flex: 1, minHeight: 0 }}>
          {originalItems.length === 0 && !latestPreview && !latestTick && overlayActive && (
            <div className="tf-waiting">
              <ThinkingDots />
              <span>Listening for text…</span>
            </div>
          )}
          {originalItems.map((item, i) => (
            <OriginalFeedItem key={`o${i}`} item={item} />
          ))}
          {latestPreview && !latestTick && (
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

// Live thumbnail of what the OCR loop is capturing. Pinned at the top of the
// Original half. The data: URL embeds the base64 PNG so no extra fetch needed.
const CaptureThumbnail = ({ thumb }) => (
  <div style={{
    padding: "8px 14px 6px",
    borderBottom: "0.5px solid var(--rt-line)",
    flex: "0 0 auto",
    background: "rgba(139,124,255,0.04)",
  }}>
    <div style={{
      fontFamily: "var(--rt-mono)",
      fontSize: 10, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--rt-fg-3)",
      marginBottom: 6,
    }}>Capturing</div>
    <img
      src={`data:image/png;base64,${thumb.base64}`}
      alt="Live capture thumbnail"
      style={{
        display: "block",
        maxWidth: "100%",
        maxHeight: 140,
        border: "1px solid var(--rt-line-2)",
        borderRadius: 4,
        imageRendering: "auto",
      }}
    />
  </div>
);

// Per-iteration OCR telemetry. The `iteration` counter incrementing is the
// definitive proof that the OCR loop is alive. Color-codes the score so the
// user can tell at a glance whether OCR is above the translation threshold.
const OcrTelemetryRow = ({ tick }) => {
  const SCORE_THRESHOLD = 2.1;
  const scoreColor =
    tick.charCount === 0       ? "var(--rt-fg-3)"     :
    tick.validityScore < SCORE_THRESHOLD ? "var(--rt-amber)" :
    "var(--rt-mint)";
  const captureKb = (tick.captureBytes / 1024).toFixed(1);
  const excerpt = tick.text
    ? `"${tick.text.length > 40 ? tick.text.substring(0, 40) + "…" : tick.text}"`
    : "(empty)";
  return (
    <div
      key={tick.iteration /* re-key on each tick so React replays the dot animation */}
      style={{
        padding: "8px 14px",
        borderBottom: "0.5px solid var(--rt-line)",
        flex: "0 0 auto",
        fontFamily: "var(--rt-mono)",
        fontSize: 10.5,
        color: "var(--rt-fg-2)",
        display: "flex", alignItems: "center", gap: 6,
        flexWrap: "wrap",
      }}
    >
      <span style={{
        display: "inline-block",
        width: 8, height: 8,
        borderRadius: "50%",
        background: "var(--rt-accent)",
        animation: "rt-glow-pulse 1s ease-in-out",
      }} />
      <span style={{ color: "var(--rt-fg-3)" }}>OCR ·</span>
      <span>iter <strong style={{ color: "var(--rt-fg)" }}>{tick.iteration}</strong></span>
      <span style={{ color: "var(--rt-fg-3)" }}>·</span>
      <span>{captureKb} KB</span>
      <span style={{ color: "var(--rt-fg-3)" }}>·</span>
      <span style={{ color: scoreColor }}>{tick.charCount} chars</span>
      <span style={{ color: "var(--rt-fg-3)" }}>·</span>
      <span style={{ color: scoreColor }}>score {tick.validityScore.toFixed(1)}</span>
      <span style={{ color: "var(--rt-fg-3)" }}>·</span>
      <span style={{ color: "var(--rt-fg-3)" }}>{tick.engineName}</span>
      {tick.text && (
        <span style={{
          width: "100%",
          marginTop: 4,
          color: "var(--rt-fg)",
          fontSize: 11,
        }}>{excerpt}</span>
      )}
      {tick.lastCapturePath && (
        <span style={{
          width: "100%",
          marginTop: 2,
          color: "var(--rt-fg-4)",
          fontSize: 9.5,
        }}>📁 {tick.lastCapturePath}</span>
      )}
    </div>
  );
};

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

/* Single-list mode — used by the Replace / Ghost render modes (anything but Inline). */
const SingleListTranslationFeed = ({ overlayActive, feed, renderMode, sourceLang, targetLang }) => {
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed.length]);

  if (!overlayActive && feed.length === 0) return <FeedEmpty />;

  const modeLabel = OVERLAY_STYLES.find(s => s.id === renderMode)?.label ?? renderMode;
  const langLabel = `${langCode(sourceLang, SOURCE_LANGUAGES)} → ${langCode(targetLang, TARGET_LANGUAGES)}`;

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
          {langLabel}
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
      Click <strong>Start translating</strong> to select the region of your
      screen to translate.
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

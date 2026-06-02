/* overlays.jsx — The translation overlay system
   4 render modes × 5 scenarios.

   Each scenario declares its "regions" — translatable areas
   with normalized coordinates (% of scene rect) and jp/en text.
   The overlay layer renders translations per the active render mode:

     • replace  — direct in-place text replacement, style-matched
     • ghost    — translated text superimposed at 90% opacity, source faded
     • parallel — translation rendered just-beside or below source
     • card     — single consolidated card near selection (Raycast-style)
*/

/* Region declarations: pos in % of scene content area */
const REGIONS_BY_SCENARIO = {
  browser: [
    { id: "title", x: 22.5, y: 24.5, w: 55, h: 8, font: 28, weight: 700,
      jp: BROWSER_ARTICLE.title, en: "Translation's future lives on top of the screen", align: "left", color: "#0d0d10" },
    { id: "subtitle", x: 22.5, y: 33.5, w: 55, h: 5, font: 14, weight: 400,
      jp: BROWSER_ARTICLE.subtitle, en: "How RealTrans reshapes real-time translation", align: "left", color: "#3a3a3a" },
    { id: "p0", x: 22.5, y: 64, w: 55, h: 7, font: 13.5, weight: 400,
      jp: BROWSER_ARTICLE.paragraphs[0].jp, en: BROWSER_ARTICLE.paragraphs[0].en, align: "left", color: "#1a1a1a", lh: 1.6 },
    { id: "p1", x: 22.5, y: 72.5, w: 55, h: 7, font: 13.5, weight: 400,
      jp: BROWSER_ARTICLE.paragraphs[1].jp, en: BROWSER_ARTICLE.paragraphs[1].en, align: "left", color: "#1a1a1a", lh: 1.6 },
    { id: "p2", x: 22.5, y: 81.5, w: 55, h: 8, font: 13.5, weight: 400,
      jp: BROWSER_ARTICLE.paragraphs[2].jp, en: BROWSER_ARTICLE.paragraphs[2].en, align: "left", color: "#1a1a1a", lh: 1.6 },
  ],
  anime: [], // anime uses inline replacement via the scene
  game: [
    { id: "dialogue", x: 8, y: 78, w: 84, h: 14, font: 16, weight: 500,
      jp: GAME_SCENE.lines.map(l => l.jp).join("\n"),
      en: GAME_SCENE.lines.map(l => l.en).join("\n"),
      align: "left", color: "#ffffff", lh: 1.6 },
  ],
  manga: [], // manga uses inline bubble replacement
  meeting: [],
};

/* ──────────────────────────────────────────────────────────────
   The Overlay layer
   ────────────────────────────────────────────────────────────── */
const OverlayLayer = ({ scenarioId, renderMode, isActive, subtitleIndex, activeSpeaker, captionIndex }) => {
  if (!isActive) return null;

  if (renderMode === "replace") {
    // All scenes now handle replace inline by accepting replaceText prop.
    return null;
  }

  if (renderMode === "ghost") {
    return <GhostOverlay scenarioId={scenarioId} subtitleIndex={subtitleIndex} captionIndex={captionIndex} />;
  }

  if (renderMode === "parallel") {
    return <ParallelOverlay scenarioId={scenarioId} subtitleIndex={subtitleIndex} captionIndex={captionIndex} />;
  }

  if (renderMode === "card") {
    return <CardOverlay scenarioId={scenarioId} subtitleIndex={subtitleIndex} captionIndex={captionIndex} />;
  }
  return null;
};

/* ──────────────────────────────────────────────────────────────
   REPLACE — browser: white sheet painted over the source paragraphs,
   then English text laid in. Mimics what "in-place replacement"
   would look like for a long-form article.
   ────────────────────────────────────────────────────────────── */
const BrowserReplace = () => {
  const regions = REGIONS_BY_SCENARIO.browser;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {regions.map(r => (
        <div key={r.id} style={{
          position: "absolute",
          left: `${r.x}%`, top: `${r.y}%`,
          width: `${r.w}%`,
          padding: "2px 4px",
          fontFamily: r.id === "title" ? "Georgia, serif" : "var(--rt-font)",
          fontSize: r.font, fontWeight: r.weight,
          color: r.color, lineHeight: r.lh || 1.35,
          background: "rgba(255,255,255,0.96)",
          textAlign: r.align,
          letterSpacing: "-0.005em",
                    borderLeft: "1.5px solid var(--rt-accent)",
          paddingLeft: 8,
        }}>
          {r.en}
        </div>
      ))}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   GHOST — translated text rendered on top of source at slight glow,
   source remains faintly visible underneath. Like seeing through
   to the original.
   ────────────────────────────────────────────────────────────── */
const GhostOverlay = ({ scenarioId, subtitleIndex, captionIndex }) => {
  // dim the source text so the translation reads on top
  return (
    <>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "rgba(0,0,0,0.18)",
              }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {scenarioId === "browser" && <GhostBrowser />}
        {scenarioId === "anime" && <GhostAnime subtitleIndex={subtitleIndex} />}
        {scenarioId === "game" && <GhostGame />}
        {scenarioId === "manga" && <GhostManga />}
        {scenarioId === "meeting" && <GhostMeeting captionIndex={captionIndex} />}
      </div>
    </>
  );
};

const GhostText = ({ children, ...props }) => (
  <div {...props} style={{
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.6), 0 0 12px rgba(139,124,255,0.55)",
    fontWeight: 500,
    background: "linear-gradient(180deg, rgba(15,15,22,0.32), rgba(15,15,22,0.32))",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    borderRadius: 3,
    padding: "2px 6px",
        ...props.style,
  }}>{children}</div>
);

const GhostBrowser = () => {
  // a single glassy violet card positioned over the article region
  return (
    <div style={{
      position: "absolute",
      left: "20%", right: "20%",
      top: "22%",
      pointerEvents: "none",
      opacity: 1,
    }}>
      <div style={{
        background: "rgba(139,124,255,0.92)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderRadius: 12,
        padding: "20px 24px",
        color: "#fff",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.18) inset",
      }}>
        <div style={{ fontFamily: "var(--rt-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.78, marginBottom: 10 }}>
          Translation · ghost layer
        </div>
        <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
          Translation's future lives on top of the screen.
        </h2>
        <div style={{ fontSize: 12.5, marginTop: 6, opacity: 0.88, lineHeight: 1.5 }}>
          How RealTrans reshapes real-time translation
        </div>
        <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, opacity: 0.92, display: "flex", flexDirection: "column", gap: 8 }}>
          {BROWSER_ARTICLE.paragraphs.map((p, i) => (
            <div key={i}>{p.en}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GhostAnime = ({ subtitleIndex }) => {
  const sub = ANIME_TIMELINE[subtitleIndex] || ANIME_TIMELINE[0];
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: "16%",
      textAlign: "center",
          }}>
      <div style={{
        display: "inline-block",
        padding: "8px 22px",
        background: "rgba(139,124,255,0.32)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 8,
        color: "#fff",
        fontSize: 26, fontWeight: 500,
        textShadow: "0 1px 4px rgba(0,0,0,0.7), 0 0 24px rgba(139,124,255,0.7)",
        letterSpacing: "-0.005em",
        boxShadow: "0 0 0 0.5px rgba(255,255,255,0.16) inset",
      }}>{sub.en}</div>
    </div>
  );
};

const GhostGame = () => {
  return (
    <div style={{
      position: "absolute", left: "8%", right: "8%", bottom: "8%",
          }}>
      <div style={{
        background: "rgba(8,10,24,0.92)",
        border: "1.5px solid rgba(245,183,94,0.85)",
        borderRadius: 4,
        padding: "16px 20px 18px",
        boxShadow: "0 0 32px rgba(245,183,94,0.28)",
      }}>
        <div style={{
          position: "absolute", top: -14, left: 18,
          background: "rgba(245,183,94,0.95)", color: "#1a1308",
          padding: "3px 12px", fontSize: 13, fontWeight: 700, borderRadius: 3,
        }}>{GAME_SCENE.speaker.en}</div>
        <div style={{ fontSize: 17, lineHeight: 1.65, color: "#fff", fontFamily: "Georgia, serif" }}>
          {GAME_SCENE.lines.map((l, i) => (
            <div key={i}>{l.en}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GhostManga = () => {
  // Floats over the manga page as a translucent violet panel
  return (
    <div style={{
      position: "absolute",
      left: "26%", right: "26%", top: "26%",
            pointerEvents: "none",
    }}>
      <div style={{
        background: "rgba(139,124,255,0.94)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderRadius: 14,
        padding: "16px 18px",
        color: "#fff",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.15) inset",
      }}>
        <div style={{ fontFamily: "var(--rt-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, marginBottom: 10 }}>
          Page · 4 bubbles
        </div>
        {MANGA_BUBBLES.map((b, i) => (
          <div key={b.id} style={{
            display: "flex", gap: 10, alignItems: "baseline",
            padding: "6px 0",
            borderBottom: i < MANGA_BUBBLES.length - 1 ? "0.5px solid rgba(255,255,255,0.18)" : "none",
          }}>
            <span style={{ fontSize: 9, opacity: 0.6, fontFamily: "var(--rt-mono)", minWidth: 18 }}>{i+1}</span>
            <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 16, letterSpacing: "0.04em", whiteSpace: "pre-line", lineHeight: 1.2 }}>{b.en}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const GhostMeeting = ({ captionIndex }) => {
  const cap = MEETING_TIMELINE[captionIndex] || MEETING_TIMELINE[0];
  return (
    <div style={{
      position: "absolute", left: 60, right: 60, bottom: 86,
      textAlign: "center",
          }}>
      <div style={{
        display: "inline-block",
        background: "rgba(139,124,255,0.96)",
        padding: "10px 22px",
        borderRadius: 10,
        fontSize: 18,
        color: "#fff", fontWeight: 500,
        boxShadow: "0 8px 24px rgba(139,124,255,0.5)",
      }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginRight: 8 }}>
          {MEETING_PARTICIPANTS.find(p=>p.id===cap.speaker)?.name}:
        </span>
        {cap.en}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   PARALLEL — translation rendered alongside source.
   ────────────────────────────────────────────────────────────── */
const ParallelOverlay = ({ scenarioId, subtitleIndex, captionIndex }) => {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {scenarioId === "browser" && <ParallelBrowser />}
      {scenarioId === "anime" && <ParallelAnime subtitleIndex={subtitleIndex} />}
      {scenarioId === "game" && <ParallelGame />}
      {scenarioId === "manga" && <ParallelManga />}
      {scenarioId === "meeting" && <ParallelMeeting captionIndex={captionIndex} />}
    </div>
  );
};

const ParallelLabel = ({ children, style, accent }) => (
  <div style={{
    fontFamily: "var(--rt-mono)",
    fontSize: 9, fontWeight: 600,
    color: accent || "var(--rt-accent-bright)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 3,
    ...style,
  }}>{children}</div>
);

const ParallelBrowser = () => {
  return (
    <div style={{
      position: "absolute",
      right: "2%", top: "22%",
      width: "26%",
            pointerEvents: "none",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.97)",
        border: "0.5px solid rgba(139,124,255,0.35)",
        borderLeft: "3px solid var(--rt-accent)",
        borderRadius: 10,
        padding: "14px 16px",
        color: "#0d0d10",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
      }}>
        <ParallelLabel accent="var(--rt-accent-deep)" style={{ marginBottom: 8 }}>Parallel · EN</ParallelLabel>
        <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
          Translation's future lives on top of the screen.
        </h2>
        <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 4, lineHeight: 1.5 }}>
          How RealTrans reshapes real-time translation
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 7 }}>
          {BROWSER_ARTICLE.paragraphs.map((p, i) => (
            <div key={i}>{p.en}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ParallelAnime = ({ subtitleIndex }) => {
  const sub = ANIME_TIMELINE[subtitleIndex] || ANIME_TIMELINE[0];
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: "26%",
      textAlign: "center",
          }}>
      <div style={{
        display: "inline-block",
        padding: "6px 18px",
        background: "rgba(139,124,255,0.94)",
        borderRadius: 6,
        fontSize: 20, color: "#fff",
        fontWeight: 500,
        textShadow: "0 1px 2px rgba(0,0,0,0.4)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}>
        <span style={{ fontFamily: "var(--rt-mono)", fontSize: 9, marginRight: 8, opacity: 0.85, letterSpacing: "0.08em", textTransform: "uppercase" }}>EN</span>
        {sub.en}
      </div>
    </div>
  );
};

const ParallelGame = () => {
  return (
    <div style={{
      position: "absolute", left: "8%", right: "8%", bottom: "26%",
          }}>
      <div style={{
        background: "rgba(245,243,255,0.97)",
        border: "1px solid rgba(139,124,255,0.45)",
        borderRadius: 4,
        padding: "10px 16px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
      }}>
        <ParallelLabel accent="var(--rt-accent-deep)" style={{ marginBottom: 4 }}>EN · {GAME_SCENE.speaker.en}</ParallelLabel>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "#0d0d10", fontFamily: "Georgia, serif" }}>
          {GAME_SCENE.lines.map((l, i) => <div key={i}>{l.en}</div>)}
        </div>
      </div>
    </div>
  );
};

const ParallelManga = () => (
  <div style={{
    position: "absolute",
    right: "2%", top: "10%",
    width: "26%",
        pointerEvents: "none",
  }}>
    <div style={{
      background: "rgba(255,255,255,0.97)",
      border: "0.5px solid rgba(139,124,255,0.35)",
      borderLeft: "3px solid var(--rt-accent)",
      borderRadius: 10,
      padding: "14px 16px",
      color: "#0d0d10",
      boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    }}>
      <ParallelLabel accent="var(--rt-accent-deep)" style={{ marginBottom: 10 }}>Parallel · 4 bubbles</ParallelLabel>
      {MANGA_BUBBLES.map((b, i) => (
        <div key={b.id} style={{
          padding: "7px 0",
          borderTop: i > 0 ? "0.5px solid #ececec" : "none",
        }}>
          <div style={{ fontFamily: "var(--rt-jp-serif)", fontSize: 10.5, color: "#888", lineHeight: 1.3, marginBottom: 2 }}>{b.jp.replace(/\n/g, " ")}</div>
          <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 14, letterSpacing: "0.04em", color: "#0d0d10", whiteSpace: "pre-line", lineHeight: 1.2 }}>{b.en}</div>
        </div>
      ))}
    </div>
  </div>
);

const ParallelMeeting = ({ captionIndex }) => {
  const cap = MEETING_TIMELINE[captionIndex] || MEETING_TIMELINE[0];
  return (
    <div style={{
      position: "absolute", left: 60, right: 60, bottom: 130,
      textAlign: "center",
          }}>
      <div style={{
        display: "inline-block",
        background: "rgba(245,243,255,0.97)",
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 15, color: "#0d0d10",
        fontWeight: 500,
        border: "0.5px solid rgba(139,124,255,0.4)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
      }}>
        <span style={{ fontFamily: "var(--rt-mono)", fontSize: 9, color: "var(--rt-accent-deep)", letterSpacing: "0.08em", marginRight: 8, textTransform: "uppercase" }}>
          EN
        </span>
        {cap.en}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   CARD — single consolidated translation card (Raycast-style)
   ────────────────────────────────────────────────────────────── */
const CardOverlay = ({ scenarioId, subtitleIndex, captionIndex }) => {
  let title = "Translation";
  let lines = [];
  let lang = "JA → EN";

  if (scenarioId === "browser") {
    title = "Article passage";
    lines = REGIONS_BY_SCENARIO.browser.slice(0, 3).map(r => ({ jp: r.jp, en: r.en }));
  } else if (scenarioId === "anime") {
    const s = ANIME_TIMELINE[subtitleIndex] || ANIME_TIMELINE[0];
    title = "Live subtitle";
    lines = [{ jp: s.jp, en: s.en }];
  } else if (scenarioId === "game") {
    title = `Dialogue · ${GAME_SCENE.speaker.en}`;
    lines = GAME_SCENE.lines.map(l => ({ jp: l.jp, en: l.en }));
  } else if (scenarioId === "manga") {
    title = "Panel · 4 bubbles";
    lines = MANGA_BUBBLES.map(b => ({ jp: b.jp, en: b.en }));
  } else if (scenarioId === "meeting") {
    const c = MEETING_TIMELINE[captionIndex] || MEETING_TIMELINE[0];
    const p = MEETING_PARTICIPANTS.find(x=>x.id===c.speaker);
    title = `Live caption · ${p?.name}`;
    lines = [{ jp: c.jp, en: c.en }];
  }

  return (
    <div style={{
      position: "absolute", right: 24, top: 24, width: 360,
      pointerEvents: "auto",
            zIndex: 10,
    }}>
      <div className="glass-strong" style={{
        padding: 14,
        borderRadius: 14,
        color: "var(--rt-fg)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Wordmark size={14} withText={false} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--rt-fg)" }}>{title}</span>
          <div style={{ flex: 1 }} />
          <Pill mono accent>{lang}</Pill>
          <span style={{ fontSize: 11, color: "var(--rt-fg-3)" }}>⌥⏎ pin</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((l, i) => (
            <div key={i}>
              <div style={{
                fontFamily: "var(--rt-jp)",
                fontSize: 12.5,
                color: "var(--rt-fg-3)",
                marginBottom: 3,
                lineHeight: 1.45,
              }}>{l.jp}</div>
              <div style={{
                fontSize: 13.5, color: "var(--rt-fg)",
                lineHeight: 1.5, fontWeight: 500,
              }}>{l.en}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: "0.5px solid var(--rt-line-2)",
          display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--rt-fg-3)"
        }}>
          <Icon name="memory" size={11}/>
          <span>Saved to glossary</span>
          <div style={{ flex: 1 }} />
          <span className="mono">282 ms</span>
          <Icon name="sparkle" size={11}/>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   INLINE replace text — used directly by scenes for "replace" mode.
   Exposed as a helper.
   ────────────────────────────────────────────────────────────── */
const animePlayingEN = (idx) => (ANIME_TIMELINE[idx] || ANIME_TIMELINE[0]).en;
const meetingCaptionEN = (idx) => MEETING_TIMELINE[idx] || MEETING_TIMELINE[0];

Object.assign(window, {
  OverlayLayer, REGIONS_BY_SCENARIO,
  animePlayingEN, meetingCaptionEN,
});

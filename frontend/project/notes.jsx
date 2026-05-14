/* notes.jsx — "Founder notes" drawer
   The deep product-thinking content from the brief: critique,
   philosophy, modes, wow features, and the MVP roadmap.
   Slides in from the right.
*/

const Notes = ({ open, onClose }) => {
  const [tab, setTab] = useState("critique");
  if (!open) return null;

  const tabs = [
    { id: "critique", label: "Critique", icon: "x" },
    { id: "vision", label: "Direction", icon: "sparkle" },
    { id: "philosophy", label: "Philosophy", icon: "wand" },
    { id: "overlay", label: "Overlay UX", icon: "layers" },
    { id: "wow", label: "Wow features", icon: "memory" },
    { id: "mvp", label: "MVP", icon: "stack" },
  ];

  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)",
        zIndex: 90, animation: "rt-fade-in 0.2s var(--rt-ease) both",
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 540,
        zIndex: 91,
        animation: "notes-slide-in 0.32s var(--rt-ease-2) both",
      }}>
        <style>{`@keyframes notes-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div className="glass-strong" style={{
          height: "100%", borderRadius: 0,
          borderLeft: "0.5px solid var(--rt-line-2)", border: 0,
          display: "flex", flexDirection: "column",
        }}>
          {/* header */}
          <div style={{
            padding: "16px 22px",
            borderBottom: "0.5px solid var(--rt-line-2)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <Wordmark size={16} />
            <div style={{ width: 1, height: 16, background: "var(--rt-line-2)" }}/>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Founder notes</div>
              <div style={{ fontSize: 10.5, color: "var(--rt-fg-3)" }}>Product thinking behind the redesign</div>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--rt-fg-3)", cursor: "pointer" }}>
              <Icon name="x" size={16}/>
            </button>
          </div>

          {/* tabs */}
          <div style={{ display: "flex", padding: "0 14px", borderBottom: "0.5px solid var(--rt-line-2)", overflowX: "auto" }}>
            {tabs.map(t => (
              <div key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 12px", display: "flex", alignItems: "center", gap: 6,
                fontSize: 11.5, fontWeight: 500,
                color: tab === t.id ? "var(--rt-fg)" : "var(--rt-fg-3)",
                borderBottom: tab === t.id ? "1.5px solid var(--rt-accent-bright)" : "1.5px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
                <Icon name={t.icon} size={12}/>
                {t.label}
              </div>
            ))}
          </div>

          {/* body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
            {tab === "critique" && <NCritique />}
            {tab === "vision" && <NVision />}
            {tab === "philosophy" && <NPhilosophy />}
            {tab === "overlay" && <NOverlay />}
            {tab === "wow" && <NWow />}
            {tab === "mvp" && <NMvp />}
          </div>
        </div>
      </div>
    </>
  );
};

/* shared typography */
const NH1 = ({ children }) => <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{children}</h1>;
const NSub = ({ children }) => <p style={{ margin: "0 0 22px", fontSize: 13, color: "var(--rt-fg-3)", lineHeight: 1.55, letterSpacing: "-0.005em" }}>{children}</p>;
const NH2 = ({ children }) => <h2 style={{ margin: "22px 0 8px", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--rt-accent-bright)", fontFamily: "var(--rt-mono)" }}>{children}</h2>;
const NP = ({ children }) => <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.6, color: "var(--rt-fg-2)", letterSpacing: "-0.003em" }}>{children}</p>;
const NLi = ({ children, k }) => (
  <li style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13, lineHeight: 1.5, color: "var(--rt-fg-2)" }}>
    {k && <span style={{ minWidth: 86, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)", fontSize: 10.5, letterSpacing: "0.03em", textTransform: "uppercase", paddingTop: 3 }}>{k}</span>}
    <span>{children}</span>
  </li>
);
const NQuote = ({ children }) => (
  <div style={{
    margin: "10px 0 18px",
    borderLeft: "1.5px solid var(--rt-accent-bright)",
    padding: "4px 0 4px 14px",
    fontSize: 14, lineHeight: 1.55, color: "var(--rt-fg)",
    fontStyle: "italic", letterSpacing: "-0.005em",
  }}>{children}</div>
);

/* ── 1. CRITIQUE ──────────────────────────────────────────────── */
const NCritique = () => (
  <div>
    <NH1>The current UX is a round-trip you don't need.</NH1>
    <NSub>Today RealTrans makes the user open an app, fire a shortcut, draw a rectangle, then read the result in a second window. Technically correct. Experientially, it's a 1990s clipboard utility wearing a 2026 logo.</NSub>

    <NQuote>"Where the source was" and "where the translation lives" are two different places. The user's attention is asked to commute between them, indefinitely.</NQuote>

    <NH2>The actual costs</NH2>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      <NLi k="Context switch">Eyes leave the manga page / subtitle / dialogue box and re-acquire it after reading the translation. Acuity drops. Lip-reading lost. Game frame missed.</NLi>
      <NLi k="Cognitive load">User must remember the source layout while reading the translation. Working memory burns 3–5 seconds per line.</NLi>
      <NLi k="Interruption">A second window steals focus on Windows. Games tab-out, video pauses, IME breaks.</NLi>
      <NLi k="Discoverability">Users don't know what's translatable until they try. No affordances on the page itself.</NLi>
      <NLi k="Reading fatigue">Two text columns demand twice the saccades. After 20 minutes of manga, eyes hurt.</NLi>
      <NLi k="Re-selection">Every paragraph, every subtitle, every bubble — re-draw the rectangle. The friction compounds.</NLi>
    </ul>

    <NH2>Why it feels old</NH2>
    <NP>Separate-window translation comes from a model where translation was a deliberate task: a thing you did to a document. But for anime watchers, manga readers, JRPG players, and people skimming a foreign Twitter thread, translation isn't a task — it's an <em>ambient property</em> of the screen they want to look at. The current shape of RealTrans fights against this every second it's running.</NP>

    <NP>The redesign starts here: <strong style={{ color: "var(--rt-fg)" }}>translation belongs where the source is, and nowhere else.</strong></NP>
  </div>
);

/* ── 2. VISION ────────────────────────────────────────────────── */
const NVision = () => (
  <div>
    <NH1>If I were the product lead.</NH1>
    <NSub>The exact direction I would push for, what I would refuse to ship, and the long game.</NSub>

    <NH2>The bet</NH2>
    <NP>RealTrans isn't a translator. It's a <strong style={{ color: "var(--rt-fg)" }}>real-time perceptual layer</strong> that makes any pixel of foreign text feel native to its reader. The product's job is to disappear into the source.</NP>

    <NH2>What I would absolutely do</NH2>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      <NLi k="In-place first">Direct replacement is the default for every mode. Ghost / Parallel / Card are escape hatches the user opts into.</NLi>
      <NLi k="Hotkey-only">No floating window in idle. The app earns its presence with a single keypress.</NLi>
      <NLi k="Smart detect">Hovering a region offers translation before the user has to draw. Drawing is the fallback.</NLi>
      <NLi k="Sticky regions">A pinned region is a first-class object that follows a window, URL pattern, or screen area across sessions.</NLi>
      <NLi k="Memory">Glossary, tone, and learned typography belong to the user — across apps, forever.</NLi>
    </ul>

    <NH2>What I would refuse to ship</NH2>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      <NLi k="Dashboards">A history view, a "translations today" widget, a stats page. None of it earns its weight.</NLi>
      <NLi k="A tab/sidebar">If the answer to a problem is "open the sidebar", we've already lost.</NLi>
      <NLi k="A subscription nag">A free tier with sensible limits. Pro is for power features (cloud OCR, OBS bridge), not for unlocking core function.</NLi>
      <NLi k="Cute mascots">No anthropomorphic translator. The app is the surface; the magic is the translation.</NLi>
      <NLi k="Onboarding gauntlet">No 7-step tour. One screen, two answers, hotkey live in 20 seconds.</NLi>
    </ul>

    <NH2>The 5-year game</NH2>
    <NP>RealTrans wins when "translation" stops being a noun to most users and becomes a property of looking. A Japanese sign in a screenshot just <em>is</em> readable. A Korean game ships and the world plays it the next day. The line between "I translated this" and "I read this" goes away. The product is invisible; the value isn't.</NP>
  </div>
);

/* ── 3. PHILOSOPHY ─────────────────────────────────────────────── */
const NPhilosophy = () => (
  <div>
    <NH1>Design philosophy</NH1>
    <NSub>What RealTrans inherits from the apps it admires. Arc's restraint, Raycast's keyboardiness, Discord's overlay discipline, Apple's animation grammar, Notion's content-first surfaces.</NSub>

    <NH2>Reference polish</NH2>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      <NLi k="Raycast">A single fast text input is the entire app for 90% of sessions. Modifier hints. Keyboard-first.</NLi>
      <NLi k="Arc">Restraint as a feature. The window doesn't compete with content; chrome is glassy, never colored.</NLi>
      <NLi k="Discord overlay">A floating layer that respects fullscreen games and never steals focus.</NLi>
      <NLi k="Apple HIG">Animations under 250ms, never linear, never bouncy. Materials communicate altitude.</NLi>
      <NLi k="Linear">Visual hierarchy through scale and weight, not borders. Nothing decorative.</NLi>
    </ul>

    <NH2>Typography</NH2>
    <NP>Geist as the system face. Geist Mono for hotkeys, coordinates, and timings — never body. Noto for Japanese / Korean / Chinese source. Translated text inherits the source's <em>role</em> (heading, caption, body) but not its specific font; we re-typeset for legibility, then optionally match style as a per-mode override.</NP>

    <NH2>Spacing</NH2>
    <NP>4px base grid. 8 / 12 / 18 / 28 stops only. No padding that doesn't pull weight. The Tweaks panel and overlays use the same scale as the main app — consistency over local prettiness.</NP>

    <NH2>Animation</NH2>
    <NP>Two easings: <code style={{ fontFamily: "var(--rt-mono)", fontSize: 12, background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4 }}>cubic-bezier(0.22, 1, 0.36, 1)</code> for UI; same with a stronger curve for entrances. 180–280ms. <strong style={{ color: "var(--rt-fg)" }}>Translations themselves fade, never slide.</strong> Movement implies a change of place; we want change of language.</NP>

    <NH2>Translucency</NH2>
    <NP>Glass surfaces only where altitude matters: palette, settings, notes. The overlay layer itself is usually opaque (translation must be legible). Backdrop blur is a flourish; the typography is the substance.</NP>

    <NH2>Visual hierarchy</NH2>
    <NP>Three weights: 400, 500, 600. Three colors of text: foreground, muted, dim. Accent (violet) appears at most twice on any screen — once as a tag, once as a CTA — never as decoration.</NP>

    <NH2>Accessibility</NH2>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      <NLi k="Contrast">Translated text always at WCAG AA against its substrate. We compute substrate brightness and invert when needed.</NLi>
      <NLi k="Font size">Adjustable in 1pt increments. Subtitle band has its own scale.</NLi>
      <NLi k="Motion">Reduce-motion users get crossfades instead of slide-ins, no exceptions.</NLi>
      <NLi k="Screen reader">Translated regions are announced. Source can be re-announced with ⌥+arrow.</NLi>
    </ul>

    <NH2>Gaming aesthetics</NH2>
    <NP>Game mode borrows from gaming HUDs (Discord, Steam, Overwolf) <em>structurally</em> — corner anchoring, transparent backgrounds, no chrome — but never <em>visually</em>. No neon, no chamfered metal, no "gamer" purple. The mode is fast and quiet; that's what gamers actually want when they're playing.</NP>

    <NH2>Minimal UI principles</NH2>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      <NLi k="Earn pixels">Every visible element has a job. If it doesn't, delete.</NLi>
      <NLi k="Hide chrome">App chrome lives in the hotkey. The screen is for content.</NLi>
      <NLi k="One color">Violet, used surgically. Mode tints (cyan / amber / rose) only inside mode contexts.</NLi>
      <NLi k="Quiet defaults">Animations are short. Toasts are rare. The product whispers.</NLi>
    </ul>
  </div>
);

/* ── 4. OVERLAY UX EXPLORATION ────────────────────────────────── */
const NOverlay = () => (
  <div>
    <NH1>Five overlay shapes, ranked.</NH1>
    <NSub>Each has a use case. The product ships with one default per mode but lets the user toggle on the fly. Toggle the rendering style in <span style={{ color: "var(--rt-accent-bright)" }}>Tweaks</span> to see each side-by-side.</NSub>

    <OverlayRow
      title="1 · Direct text replacement"
      best="Best: subtitles, manga bubbles, game dialogue, single sentences"
      tag="Default for most modes"
      pros={["Highest immersion — feels like the content is just in your language","Zero context switch","Natural for short or self-contained text"]}
      cons={["Hard when source typography is exotic (manga lettering, pixel fonts)","Failure modes look broken: a wrong translation has nowhere to hide","Length mismatches need typesetting cleverness"]}
      quality="★★★★★ (when it works)"
      immersion="Total"
    />
    <OverlayRow
      title="2 · Ghost layer"
      best="Best: language learners, verifying a translation, ambiguous text"
      pros={["Source remains glance-able underneath","Trust signal: user can confirm OCR caught the right thing","Beautiful — glass over content"]}
      cons={["Two layers compete visually","Source legibility suffers","Cognitive load goes up if user actually reads both"]}
      quality="★★★★"
      immersion="High"
    />
    <OverlayRow
      title="3 · Parallel translation"
      best="Best: study mode, long articles, side-by-side reading"
      pros={["Pedagogically useful","No information loss","Layout-friendly for documents"]}
      cons={["Doubles screen real estate","Loses the 'magic' of in-place","Feels closer to traditional translators"]}
      quality="★★★"
      immersion="Medium"
    />
    <OverlayRow
      title="4 · Floating card (Raycast-style)"
      best="Best: one-off translations, tooltips, mouse-hover lookups"
      pros={["Lightweight — appears, fades","Doesn't disturb source","Great as a hover affordance"]}
      cons={["Still introduces a glance off-source","Not viable for streaming content like subtitles","Risk of feeling like the old separate window in miniature"]}
      quality="★★★"
      immersion="Low–medium"
    />
    <OverlayRow
      title="5 · Adaptive (per-region)"
      best="Best: power users, mixed-content screens"
      tag="The ambitious answer"
      pros={["Each region gets the shape that fits it","Subtitle band gets replace, document gets parallel, etc.","Makes RealTrans feel intelligent rather than configured"]}
      cons={["Hard to teach what's happening","Inconsistency can read as instability","Requires very good auto-classification"]}
      quality="★★★★★"
      immersion="Total"
    />
  </div>
);

const OverlayRow = ({ title, best, tag, pros, cons, quality, immersion }) => (
  <div style={{
    padding: 14, borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "0.5px solid var(--rt-line-2)",
    marginBottom: 10,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</span>
      {tag && <Pill mono accent style={{ fontSize: 9, padding: "1px 6px" }}>{tag}</Pill>}
    </div>
    <div style={{ fontSize: 11.5, color: "var(--rt-fg-3)", marginBottom: 10 }}>{best}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#5eead4", fontFamily: "var(--rt-mono)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Pros</div>
        {pros.map((p, i) => <div key={i} style={{ fontSize: 12, color: "var(--rt-fg-2)", lineHeight: 1.5, marginBottom: 3, paddingLeft: 9, position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#5eead4" }}>+</span>{p}</div>)}
      </div>
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#f471a8", fontFamily: "var(--rt-mono)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Cons</div>
        {cons.map((p, i) => <div key={i} style={{ fontSize: 12, color: "var(--rt-fg-2)", lineHeight: 1.5, marginBottom: 3, paddingLeft: 9, position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#f471a8" }}>−</span>{p}</div>)}
      </div>
    </div>
    <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 8, borderTop: "0.5px dashed var(--rt-line)", fontSize: 10.5, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)" }}>
      <span>quality: <span style={{ color: "var(--rt-fg)" }}>{quality}</span></span>
      <span>immersion: <span style={{ color: "var(--rt-fg)" }}>{immersion}</span></span>
    </div>
  </div>
);

/* ── 5. WOW FEATURES ──────────────────────────────────────────── */
const NWow = () => {
  const features = [
    { name: "Smart region tracking", desc: "When a subtitle moves frame-to-frame or a manga panel scrolls, the pinned region tracks with it. No re-selection ever.", level: "Buildable" },
    { name: "Subtitle stabilization", desc: "Re-OCRs every frame but only swaps text when content actually changes. No flicker. Adds 80ms of perceived smoothness.", level: "Buildable" },
    { name: "Glossary memory", desc: "RealTrans remembers that ‘霧の谷' means ‘Valley of Mist' in your game. Forever. Across saves and sessions.", level: "Buildable" },
    { name: "Auto-bubble detection", desc: "For manga, finds every bubble in a panel and translates them as a group, preserving reading order (top-right → bottom-left).", level: "Buildable" },
    { name: "Speaker-aware captions", desc: "Live mode tags each translated line with the actual speaker, learned from voice fingerprints. Speakers get color and continuity.", level: "Buildable" },
    { name: "Semantic mode", desc: "Translate not the words but the intent. JRPG dialogue gets archaic flavor; technical docs get terseness; jokes get equivalents.", level: "Stretch" },
    { name: "Predictive translation", desc: "For paused video, RealTrans translates the next 2 subtitles before they appear. Latency drops to zero.", level: "Stretch" },
    { name: "Adaptive overlay", desc: "Each region picks the best rendering style by itself — subtitle band gets Replace, document gets Parallel — without the user choosing.", level: "Stretch" },
    { name: "Reading-order awareness", desc: "Manga is read right-to-left, top-to-bottom. RealTrans presents bubbles in that order whether the user clicks them or not.", level: "Buildable" },
    { name: "Lip-sync hint", desc: "In live calls, translated captions are timed to mouth movement, not audio. Compensates for translation lag automatically.", level: "Stretch" },
    { name: "Game-engine OCR shortcut", desc: "For Unity/UE games, RealTrans can read text directly from rendered draw calls — 10x faster than screen OCR.", level: "Moonshot" },
    { name: "Onlooker mode", desc: "Watching with someone else who reads the source? Show translations only on YOUR display via second-screen pairing.", level: "Moonshot" },
  ];
  return (
    <div>
      <NH1>Things that should make a user say "how".</NH1>
      <NSub>The wow features. Ranked from buildable-this-quarter to long-game moonshots. The first cluster is the MVP of magic.</NSub>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {features.map((f, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid var(--rt-line-2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</span>
              <Pill mono style={{
                background: f.level === "Buildable" ? "rgba(94,234,212,0.1)" : f.level === "Stretch" ? "rgba(245,183,94,0.1)" : "rgba(244,113,168,0.1)",
                color: f.level === "Buildable" ? "#5eead4" : f.level === "Stretch" ? "#f5b75e" : "#f471a8",
                borderColor: f.level === "Buildable" ? "rgba(94,234,212,0.3)" : f.level === "Stretch" ? "rgba(245,183,94,0.3)" : "rgba(244,113,168,0.3)",
                fontSize: 9, padding: "1px 6px",
              }}>{f.level}</Pill>
            </div>
            <div style={{ fontSize: 12, color: "var(--rt-fg-2)", lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── 6. MVP ROADMAP ─────────────────────────────────────────── */
const NMvp = () => {
  return (
    <div>
      <NH1>The MVP I'd ship.</NH1>
      <NSub>Three phases. Each one is shippable on its own. Each one earns the next.</NSub>

      <MvpPhase
        v="v0.1 — 3 months"
        title="The hotkey, the selection, the overlay"
        goal="Prove the central thesis: in-place is better than separate."
        items={[
          "Global hotkey (cross-platform)",
          "Smart-region detection on hover for text-dense windows",
          "Drag selection fallback",
          "Direct text replacement for browser & subtitles (Replace mode only)",
          "JA/KO/ZH → EN, on-device OCR",
          "Onboarding: 3 screens, 20 seconds",
          "Tray-only chrome. No app window.",
        ]}
        skip="Modes (one default), Pinned regions, Glossary, Live captions, Card/Ghost/Parallel."
      />

      <MvpPhase
        v="v0.5 — 6 months"
        title="Modes, pins, and memory"
        goal="Make the product worth keeping after the first wow moment."
        items={[
          "Mode auto-detection (Document / Subtitle / Manga / Game)",
          "Pinned regions that follow windows",
          "Glossary memory per app",
          "Ghost / Parallel / Card render modes",
          "Stabilization for subtitle band",
          "Manga bubble auto-detection",
          "Per-mode appearance settings",
        ]}
        skip="Live audio captions, Streamer mode, Predictive translation."
      />

      <MvpPhase
        v="v1.0 — 12 months"
        title="Live + Stream + Polish"
        goal="Become the answer in five categories at once."
        items={[
          "Live mode: audio capture, speaker-aware captions",
          "Streamer mode: OBS bridge, virtual display source",
          "Predictive translation for paused video",
          "Cloud OCR option for long documents",
          "Tone profiles per app",
          "Adaptive overlay (auto-picks render style)",
          "RealTrans Pro pricing",
        ]}
        skip="Game-engine OCR (research), Onlooker mode (research)."
      />

      <div style={{ marginTop: 22, padding: 14, borderRadius: 10, background: "rgba(139,124,255,0.10)", border: "0.5px solid rgba(139,124,255,0.32)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Icon name="wand" size={14} style={{ color: "var(--rt-accent-bright)" }}/>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>The launch story</span>
        </div>
        <NP>"You have a Japanese article open. Press ⌃⌥Space. It's English. That's the entire product." Demo video is 8 seconds. Everything else is for users who already believe.</NP>
      </div>
    </div>
  );
};

const MvpPhase = ({ v, title, goal, items, skip }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: "var(--rt-mono)", fontSize: 10.5, padding: "2px 8px", background: "var(--rt-accent)", color: "#fff", borderRadius: 5, fontWeight: 600, letterSpacing: "0.02em" }}>{v}</span>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em" }}>{title}</span>
    </div>
    <div style={{ fontSize: 12, color: "var(--rt-fg-3)", marginBottom: 8 }}>{goal}</div>
    <div style={{
      padding: 12, borderRadius: 8,
      background: "rgba(255,255,255,0.03)",
      border: "0.5px solid var(--rt-line-2)",
    }}>
      <div style={{ fontSize: 10, color: "var(--rt-fg-3)", fontFamily: "var(--rt-mono)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Ship</div>
      {items.map((it, i) => (
        <div key={i} style={{ fontSize: 12.5, color: "var(--rt-fg-2)", lineHeight: 1.55, paddingLeft: 14, position: "relative", marginBottom: 2 }}>
          <span style={{ position: "absolute", left: 0, color: "var(--rt-accent-bright)" }}>·</span>
          {it}
        </div>
      ))}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "0.5px dashed var(--rt-line)", fontSize: 10, color: "var(--rt-fg-3)" }}>
        <span style={{ fontFamily: "var(--rt-mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Defer:</span> {skip}
      </div>
    </div>
  </div>
);

Object.assign(window, { Notes });

/* scenarios.jsx — the 5 background scenes that fill the desktop window.
   Each renders the "untranslated" content. Regions for translation are
   exposed via data-region attrs so the selection layer can target them.
*/

/* ──────────────────────────────────────────────────────────────
   1. BROWSER — Japanese article on a faux ITmedia page
   ────────────────────────────────────────────────────────────── */
const SceneBrowser = ({ replaceText }) => {
  const a = BROWSER_ARTICLE;
  const T = (jp, en) => (replaceText ? en : jp);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f6f6f4", color: "#1a1a1a", fontFamily: "var(--rt-jp)" }}>
      {/* Edge chrome */}
      <div style={{ background: "#22232a", padding: "6px 10px 4px", color: "rgba(255,255,255,0.7)" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* tabs */}
          <div style={{ display: "flex", gap: 2, flex: 1 }}>
            <BrowserTab title="ITmedia NEWS" icon="◎" active />
            <BrowserTab title="X / @yamada_d" icon="✕" />
            <BrowserTab title="GitHub" icon="●" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 4px 4px", color: "rgba(255,255,255,0.85)" }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>← → ↻</span>
          <div style={{
            flex: 1,
            background: "rgba(0,0,0,0.35)",
            padding: "5px 10px",
            borderRadius: 14,
            fontSize: 11, color: "rgba(255,255,255,0.8)",
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "var(--rt-mono)",
          }}>
            <Icon name="lock" size={10} />
            <span>{a.url}</span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.6 }}>⋯</span>
        </div>
      </div>

      {/* page */}
      <div style={{ flex: 1, overflow: "auto", padding: "28px 0", background: "#fff" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 28px" }}>
          {/* topbar */}
          <div style={{ borderBottom: "1px solid #ececec", paddingBottom: 12, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--rt-jp-serif)", fontSize: 19, fontWeight: 700, color: "#c9181f", letterSpacing: "-0.01em" }}>
              ITmedia NEWS
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#666" }}>
              <span>テクノロジー</span><span>ビジネス</span><span>製品</span><span>連載</span>
            </div>
          </div>

          {/* article */}
          <div style={{ marginBottom: 10, fontSize: 11, color: "#888", display: "flex", gap: 10 }}>
            <span>{a.date}</span>
            <span>{a.author}</span>
          </div>
          <h1 data-region="title" style={{
            fontFamily: replaceText ? "Georgia, serif" : "var(--rt-jp-serif)",
            fontSize: 32, fontWeight: 700,
            margin: "8px 0 12px", letterSpacing: "-0.01em", lineHeight: 1.25, color: "#0d0d10",
          }}>
            {T(a.title, "Translation's future lives on top of the screen.")}
          </h1>
          <div data-region="subtitle" style={{ fontFamily: replaceText ? "var(--rt-font)" : "var(--rt-jp)", fontSize: 15, color: "#3a3a3a", marginBottom: 22, lineHeight: 1.6 }}>
            {T(a.subtitle, "How RealTrans reshapes real-time translation")}
          </div>
          <div style={{
            height: 200,
            background: "linear-gradient(135deg, #ddd9d2 0%, #c8c2b6 50%, #b8af9d 100%)",
            borderRadius: 4,
            marginBottom: 22,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 30% 60%, rgba(139,124,255,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 40%, rgba(94,234,212,0.4) 0%, transparent 50%)",
            }} />
            <div style={{ position: "absolute", bottom: 8, right: 12, fontSize: 10, color: "rgba(0,0,0,0.5)" }}>画像: ITmedia</div>
          </div>

          {a.paragraphs.map((p, i) => (
            <p key={i} data-region={`p-${i}`} style={{
              fontFamily: replaceText ? "var(--rt-font)" : "var(--rt-jp)",
              fontSize: 15, lineHeight: 1.95, color: "#1a1a1a",
              margin: "0 0 18px", letterSpacing: "0.01em",
            }}>
              {T(p.jp, p.en)}
            </p>
          ))}

          {/* fake share toolbar */}
          <div style={{ display: "flex", gap: 8, marginTop: 28, paddingTop: 16, borderTop: "1px solid #ececec", color: "#777", fontSize: 11 }}>
            <span>シェア:</span><span>X</span><span>Facebook</span><span>はてな</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const BrowserTab = ({ title, icon, active }) => (
  <div style={{
    padding: "5px 12px 5px 10px",
    background: active ? "#fff" : "rgba(255,255,255,0.05)",
    color: active ? "#1a1a1a" : "rgba(255,255,255,0.75)",
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    fontSize: 11, display: "flex", alignItems: "center", gap: 6,
    maxWidth: 200,
  }}>
    <span style={{ opacity: 0.6 }}>{icon}</span>
    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
    {active && <span style={{ marginLeft: 8, opacity: 0.4 }}>×</span>}
  </div>
);

/* ──────────────────────────────────────────────────────────────
   2. ANIME — fake video player with a playing scene
   ────────────────────────────────────────────────────────────── */
const SceneAnime = ({ subtitleIndex, replaceText }) => {
  const sub = ANIME_TIMELINE[subtitleIndex] || ANIME_TIMELINE[0];
  const displayText = replaceText ? sub.en : sub.jp;
  const displayFont = replaceText ? "var(--rt-font)" : "var(--rt-jp)";
  return (
    <div style={{ height: "100%", background: "#0a0a0d", position: "relative", color: "#fff", overflow: "hidden" }}>
      {/* faux anime backdrop — illustrated scene */}
      <AnimeBackdrop />

      {/* subtitle band */}
      <div data-region="subtitles" style={{
        position: "absolute", left: 0, right: 0, bottom: "16%",
        textAlign: "center",
        fontFamily: displayFont, fontSize: replaceText ? 26 : 28, fontWeight: 500,
        color: "#fff",
        textShadow: "0 2px 8px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,1)",
        letterSpacing: "0.02em",
        padding: "0 40px",
        animation: replaceText ? "rt-fade-in .25s var(--rt-ease) both" : undefined,
      }}>
        {displayText}
      </div>

      {/* video player chrome */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
        padding: "30px 18px 14px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--rt-mono)", color: "rgba(255,255,255,0.85)" }}>
          <span>00:{String(12 + subtitleIndex*4).padStart(2,"0")}:{String(43 + subtitleIndex*7).padStart(2,"0")}</span>
          <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 2, margin: "0 10px", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, width: `${22 + subtitleIndex*4}%`, background: "#e95e5e", borderRadius: 2 }} />
          </div>
          <span>00:24:18</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#fff" }}>
          <span style={{ fontSize: 18 }}>▶</span>
          <span style={{ fontSize: 14 }}>⏭</span>
          <span style={{ fontSize: 14 }}>🔊</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Yoru no Tegami · Ep 04</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, opacity: 0.7 }}>1080p</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>JP audio · JP subs</span>
          <span style={{ fontSize: 14 }}>⛶</span>
        </div>
      </div>
    </div>
  );
};

const AnimeBackdrop = () => (
  <svg width="100%" height="100%" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
    <defs>
      <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#1a1626"/>
        <stop offset="50%" stopColor="#3a2547"/>
        <stop offset="100%" stopColor="#824b6e"/>
      </linearGradient>
      <radialGradient id="moon" cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="#fff8d4"/>
        <stop offset="60%" stopColor="#f5e4a0" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#f5e4a0" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="500" fill="url(#sky)"/>
    {/* stars */}
    {Array.from({length: 60}).map((_,i) => (
      <circle key={i} cx={(i*53)%780+10} cy={(i*37)%240+10} r={(i%3)*0.4+0.3} fill="#fff" opacity={0.4 + (i%5)*0.1}/>
    ))}
    {/* moon */}
    <circle cx="640" cy="120" r="60" fill="url(#moon)"/>
    <circle cx="640" cy="120" r="36" fill="#fff8e0" opacity="0.95"/>
    {/* far mountains */}
    <path d="M0 320 L120 240 L240 290 L380 220 L520 280 L660 230 L800 270 L800 500 L0 500 Z" fill="#1a1a26" opacity="0.85"/>
    {/* nearer hills */}
    <path d="M0 380 L150 320 L320 370 L500 330 L700 380 L800 350 L800 500 L0 500 Z" fill="#0c0c14"/>
    {/* two silhouette figures on right */}
    <g transform="translate(420, 280)">
      <ellipse cx="0" cy="135" rx="100" ry="6" fill="#000" opacity="0.4"/>
      {/* figure 1 */}
      <g transform="translate(-30, 0)">
        <circle cx="0" cy="20" r="14" fill="#1c1828"/>
        <rect x="-12" y="32" width="24" height="50" rx="4" fill="#2a2438"/>
        <rect x="-13" y="78" width="10" height="50" rx="3" fill="#15121d"/>
        <rect x="3" y="78" width="10" height="50" rx="3" fill="#15121d"/>
      </g>
      {/* figure 2 (slightly shorter) */}
      <g transform="translate(40, 8)">
        <circle cx="0" cy="20" r="13" fill="#1f1a2a"/>
        <rect x="-11" y="31" width="22" height="46" rx="4" fill="#322a44"/>
        <rect x="-12" y="73" width="9" height="48" rx="3" fill="#181420"/>
        <rect x="3" y="73" width="9" height="48" rx="3" fill="#181420"/>
      </g>
    </g>
    {/* lens grain */}
    <rect width="800" height="500" fill="url(#sky)" opacity="0.0"/>
  </svg>
);

/* ──────────────────────────────────────────────────────────────
   3. GAME — JRPG dialogue overlay on a fantasy scene
   ────────────────────────────────────────────────────────────── */
const SceneGame = ({ replaceText }) => {
  const g = GAME_SCENE;
  return (
    <div style={{ height: "100%", background: "#0b0d18", position: "relative", overflow: "hidden", color: "#fff" }}>
      <GameBackdrop />

      {/* HUD top-left */}
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--rt-mono)", fontSize: 11 }}>
        <div data-region="hud-hp" style={{
          background: "rgba(0,0,0,0.55)", padding: "6px 12px", borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", gap: 8,
          minWidth: 180,
        }}>
          <span style={{ color: "#f5b75e", fontFamily: "var(--rt-jp)" }}>体力</span>
          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: "78%", height: "100%", background: "linear-gradient(90deg, #ff6b6b, #f5b75e)" }} />
          </div>
          <span>78</span>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.55)", padding: "6px 12px", borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", gap: 8,
          minWidth: 180,
        }}>
          <span style={{ color: "#8b7cff", fontFamily: "var(--rt-jp)" }}>魔力</span>
          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: "42%", height: "100%", background: "linear-gradient(90deg, #8b7cff, #5eead4)" }} />
          </div>
          <span>42</span>
        </div>
      </div>

      {/* Menu top-right */}
      <div data-region="menu" style={{
        position: "absolute", top: 16, right: 16,
        background: "rgba(8, 10, 24, 0.85)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 4,
        padding: "6px 0", minWidth: 110,
        fontFamily: replaceText ? "var(--rt-font)" : "var(--rt-jp)", fontSize: 14,
      }}>
        {g.menu.map((m, i) => (
          <div key={i} style={{
            padding: "5px 14px",
            color: i === 0 ? "#fff" : "rgba(255,255,255,0.65)",
            background: i === 0 ? "rgba(245,183,94,0.16)" : "transparent",
            borderLeft: i === 0 ? "2px solid #f5b75e" : "2px solid transparent",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {i === 0 && <span style={{ color: "#f5b75e", fontSize: 10 }}>▶</span>}
            {replaceText ? m.en : m.jp}
          </div>
        ))}
      </div>

      {/* dialogue box bottom */}
      <div data-region="dialogue" style={{
        position: "absolute", left: "8%", right: "8%", bottom: "8%",
        background: "rgba(8, 10, 24, 0.92)",
        border: "1.5px solid rgba(245,183,94,0.65)",
        borderRadius: 4,
        padding: "16px 20px 18px",
        fontFamily: replaceText ? "Georgia, serif" : "var(--rt-jp)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.5), 0 0 32px rgba(245,183,94,0.18)",
      }}>
        <div style={{
          position: "absolute", top: -14, left: 18,
          background: "rgba(245,183,94,0.95)", color: "#1a1308",
          padding: "3px 12px", fontSize: 13, fontWeight: 700,
          borderRadius: 3, letterSpacing: "0.02em",
          fontFamily: replaceText ? "var(--rt-font)" : "var(--rt-jp)",
        }}>
          {replaceText ? g.speaker.en : g.speaker.jp}
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.65, color: "#fff" }}>
          {g.lines.map((l, i) => <div key={i} style={{ marginBottom: i < g.lines.length-1 ? 4 : 0 }}>{replaceText ? l.en : l.jp}</div>)}
        </div>
        <div style={{ position: "absolute", bottom: 10, right: 14, fontSize: 12, color: "#f5b75e", animation: "rt-blink 1.4s infinite" }}>▼</div>
      </div>
    </div>
  );
};

const GameBackdrop = () => (
  <svg width="100%" height="100%" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
    <defs>
      <linearGradient id="gsky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#0d1428"/>
        <stop offset="100%" stopColor="#2a1a3a"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="#f5b75e" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#f5b75e" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="500" fill="url(#gsky)"/>
    {/* arch */}
    <ellipse cx="400" cy="500" rx="380" ry="160" fill="url(#glow)" opacity="0.6"/>
    {/* cathedral silhouettes */}
    <path d="M0 380 L80 280 L80 380 L140 240 L200 380 L260 200 L320 380 L380 280 L420 280 L480 380 L540 200 L600 380 L660 240 L720 380 L800 280 L800 500 L0 500 Z" fill="#100a1c"/>
    {/* center character (knight) */}
    <g transform="translate(380, 280)">
      <ellipse cx="20" cy="170" rx="60" ry="6" fill="#000" opacity="0.5"/>
      <path d="M0 30 L40 30 L40 130 L0 130 Z" fill="#1c2238" opacity="0.95"/>
      <path d="M-6 30 L46 30 L40 6 L0 6 Z" fill="#2a3454"/>
      <circle cx="20" cy="20" r="8" fill="#f5b75e" opacity="0.8"/>
      <path d="M44 50 L60 50 L60 110 L44 110 Z" fill="#1a2030"/>
      <path d="M-12 50 L0 50 L0 110 L-12 110 Z" fill="#1a2030"/>
    </g>
    {/* light particles */}
    {Array.from({length: 24}).map((_, i) => (
      <circle key={i} cx={(i*73)%780+10} cy={(i*43)%320+80} r={1.5} fill="#f5b75e" opacity={0.5 + (i%4)*0.1}/>
    ))}
  </svg>
);

/* ──────────────────────────────────────────────────────────────
   4. MANGA — full-page reader with speech bubbles
   ────────────────────────────────────────────────────────────── */
const SceneManga = ({ replaceText }) => {
  return (
    <div style={{ height: "100%", background: "#2a2628", display: "flex", flexDirection: "column", color: "#fff", fontFamily: "var(--rt-font)" }}>
      {/* reader chrome */}
      <div style={{ background: "#1a1819", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: "rgba(255,255,255,0.65)", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontWeight: 600, color: "#fff" }}>夜の手紙</span>
        <span style={{ opacity: 0.5 }}>Vol. 12 — Ch. 087</span>
        <div style={{ flex: 1 }} />
        <span>p. 14 / 24</span>
        <span>JP → EN</span>
      </div>

      {/* manga page */}
      <div style={{ flex: 1, padding: "16px 0", overflow: "auto", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "min(78%, 540px)", aspectRatio: "5/7", background: "#ece7df", borderRadius: 2, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          <MangaPage />
          {/* bubbles overlayed via absolute positioning */}
          {MANGA_BUBBLES.map(b => (
            <MangaBubble key={b.id} bubble={b} replaceText={replaceText} />
          ))}
        </div>
      </div>

      {/* footer */}
      <div style={{ background: "#1a1819", padding: "8px 16px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
        ← prev page · next page →
      </div>
    </div>
  );
};

const MangaPage = () => (
  <svg width="100%" height="100%" viewBox="0 0 500 700" preserveAspectRatio="none" style={{ display: "block" }}>
    {/* page border */}
    <rect width="500" height="700" fill="#ece7df"/>
    {/* 4-panel layout */}
    <g stroke="#1a1614" strokeWidth="2" fill="none">
      <rect x="20" y="20" width="220" height="280"/>
      <rect x="250" y="20" width="230" height="180"/>
      <rect x="250" y="210" width="230" height="90"/>
      <rect x="20" y="310" width="460" height="370"/>
    </g>
    {/* panel 1 — closeup */}
    <g transform="translate(130, 160)">
      <circle cx="0" cy="0" r="60" fill="#fff" stroke="#1a1614" strokeWidth="1.5"/>
      <ellipse cx="-18" cy="-10" rx="10" ry="14" fill="#1a1614"/>
      <ellipse cx="18" cy="-10" rx="10" ry="14" fill="#1a1614"/>
      <path d="M-12 22 Q0 30 12 22" stroke="#1a1614" strokeWidth="2" fill="none"/>
      {/* spiky hair */}
      <path d="M-50 -30 L-40 -55 L-25 -38 L-10 -60 L5 -40 L20 -58 L35 -36 L48 -50 L50 -30" fill="#1a1614"/>
    </g>
    {/* panel 2 — wide shot */}
    <g transform="translate(365, 110)">
      <path d="M-80 50 L-50 0 L-20 20 L10 -30 L40 20 L70 -10 L90 30 L90 70 L-80 70 Z" fill="#1a1614" opacity="0.92"/>
      <circle cx="0" cy="-50" r="18" fill="#f5e4a0"/>
    </g>
    {/* panel 3 — text/effect */}
    <g transform="translate(365, 260)">
      <text x="0" y="0" textAnchor="middle" fontSize="34" fontFamily="Bangers" fill="#1a1614" letterSpacing="2" fontWeight="700">バッ！！</text>
      <path d="M-90 -30 L-100 -25 M-95 0 L-105 0 M-90 30 L-100 35 M90 -30 L100 -25 M95 0 L105 0 M90 30 L100 35" stroke="#1a1614" strokeWidth="3"/>
    </g>
    {/* panel 4 — big action shot */}
    <g transform="translate(250, 500)">
      {/* speed lines */}
      {Array.from({length:30}).map((_,i) => {
        const a = (i / 30) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a)*60} y1={Math.sin(a)*60} x2={Math.cos(a)*200} y2={Math.sin(a)*200} stroke="#1a1614" strokeWidth={(i%3)*0.6+0.6}/>;
      })}
      {/* two figures clashing */}
      <g transform="translate(-90, 0)">
        <circle cx="0" cy="-30" r="18" fill="#fff" stroke="#1a1614" strokeWidth="1.5"/>
        <path d="M-25 -10 L-10 30 L0 0 L10 30 L25 -10 Z" fill="#1a1614"/>
        <line x1="0" y1="-8" x2="60" y2="-30" stroke="#1a1614" strokeWidth="5"/>
      </g>
      <g transform="translate(90, 10)">
        <circle cx="0" cy="-30" r="18" fill="#1a1614"/>
        <path d="M-25 -10 L-10 30 L0 0 L10 30 L25 -10 Z" fill="#1a1614"/>
        <line x1="0" y1="-8" x2="-60" y2="-30" stroke="#1a1614" strokeWidth="5"/>
      </g>
    </g>
  </svg>
);

const MangaBubble = ({ bubble: b, replaceText }) => {
  const isSpike = b.shape === "spike";
  const text = replaceText ? b.en : b.jp;
  const family = replaceText ? "'Bangers', 'Comic Sans MS', sans-serif" : "var(--rt-jp-serif)";
  return (
    <div data-region={`bubble-${b.id}`} style={{
      position: "absolute",
      left: `${b.x}%`, top: `${b.y}%`,
      width: `${b.w}%`, height: `${b.h}%`,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "auto",
    }}>
      {/* bubble shape */}
      {isSpike ? (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <polygon points="3,4 18,16 30,2 45,18 58,2 72,18 86,2 97,12 90,28 100,40 88,46 96,56 78,52 64,58 50,52 36,58 22,52 6,56 14,46 1,40 12,28" fill="#fff" stroke="#1a1614" strokeWidth="1.6"/>
        </svg>
      ) : (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <ellipse cx="50" cy="30" rx="48" ry="27" fill="#fff" stroke="#1a1614" strokeWidth="1.4"/>
        </svg>
      )}
      <div style={{
        position: "relative",
        fontFamily: family,
        fontWeight: b.style === "bold" ? 700 : 500,
        fontSize: replaceText ? "min(1.7vw, 13px)" : "min(2vw, 16px)",
        color: "#1a1614",
        textAlign: "center",
        whiteSpace: "pre-line",
        lineHeight: 1.2,
        zIndex: 1,
        letterSpacing: replaceText ? "0.04em" : 0,
      }}>{text}</div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   5. MEETING — Google Meet-ish video call
   ────────────────────────────────────────────────────────────── */
const SceneMeeting = ({ activeSpeaker, captionIndex, replaceText }) => {
  const cap = MEETING_TIMELINE[captionIndex] || MEETING_TIMELINE[0];
  const speaker = MEETING_PARTICIPANTS.find(p=>p.id===cap.speaker);
  return (
    <div style={{ height: "100%", background: "#0a0b0e", color: "#fff", display: "flex", flexDirection: "column", fontFamily: "var(--rt-font)" }}>
      {/* main grid */}
      <div style={{ flex: 1, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {MEETING_PARTICIPANTS.map(p => (
          <ParticipantTile key={p.id} p={p} speaking={p.id === activeSpeaker} large={p.id === activeSpeaker}/>
        ))}
      </div>

      {/* live caption strip */}
      <div data-region="captions" style={{
        position: "absolute", left: 60, right: 60, bottom: 86,
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          background: "rgba(0,0,0,0.78)",
          padding: "10px 22px",
          borderRadius: 10,
          fontSize: replaceText ? 17 : 18, fontFamily: replaceText ? "var(--rt-font)" : "var(--rt-jp)", color: "#fff",
          fontWeight: 500, lineHeight: 1.4,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          maxWidth: "80%",
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "var(--rt-font)", marginRight: 8 }}>
            {speaker?.name}:
          </span>
          {replaceText ? cap.en : cap.jp}
        </div>
      </div>

      {/* meeting toolbar */}
      <div style={{
        height: 64,
        background: "#1a1c22", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
      }}>
        <MeetBtn glyph={<Icon name="mic" size={18}/>} />
        <MeetBtn glyph={<Icon name="video" size={18}/>} />
        <MeetBtn glyph="cc" />
        <MeetBtn glyph={<Icon name="more" size={18}/>} />
        <MeetBtn glyph="✕" red />
      </div>
    </div>
  );
};

const ParticipantTile = ({ p, speaking, large }) => (
  <div style={{
    position: "relative", borderRadius: 10, overflow: "hidden",
    background: "linear-gradient(140deg, #1c1f2a 0%, #14161e 100%)",
    border: speaking ? "2px solid #5eead4" : "1px solid rgba(255,255,255,0.07)",
    aspectRatio: "16/10",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      width: 80, height: 80, borderRadius: 999,
      background: `linear-gradient(140deg, ${p.color}, ${p.color}aa)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 30, fontWeight: 600, color: "#0a0a0d",
    }}>
      {p.initials}
    </div>
    <div style={{ position: "absolute", left: 10, bottom: 10, fontSize: 11, color: "#fff" }}>
      <div style={{ fontWeight: 600 }}>{p.name}</div>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>{p.role}</div>
    </div>
    {speaking && (
      <div style={{ position: "absolute", right: 10, top: 10, display: "flex", gap: 2, alignItems: "flex-end", height: 14 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{ width: 3, background: "#5eead4", animation: `rt-blink ${0.6 + i*0.1}s infinite`, height: 6 + i*3, borderRadius: 1 }}/>
        ))}
      </div>
    )}
  </div>
);

const MeetBtn = ({ glyph, red }) => (
  <div style={{
    width: 44, height: 44, borderRadius: 999,
    background: red ? "#e95e5e" : "rgba(255,255,255,0.08)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 14, fontWeight: 600,
  }}>{glyph}</div>
);

Object.assign(window, {
  SceneBrowser, SceneAnime, SceneGame, SceneManga, SceneMeeting,
});

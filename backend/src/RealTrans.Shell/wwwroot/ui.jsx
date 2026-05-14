/* ui.jsx — shared primitives, icons, the RT wordmark */
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

/* ── Icons ────────────────────────────────────────────────────── */
const Icon = ({ name, size = 16, stroke = 1.6, className, style }) => {
  const s = size;
  const common = {
    width: s, height: s, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
    className, style,
  };
  switch (name) {
    case "rt":
      // RealTrans logo glyph — two stacked brackets becoming letterforms
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" strokeWidth={stroke}>
          <path d="M5 6 L5 18" />
          <path d="M5 6 L11 6" />
          <path d="M11 18 L11 12 L13 12 C15 12 16 13 16 15 C16 17 15 18 13 18 L11 18 Z" fill="currentColor" stroke="none" opacity="0.0" />
          <path d="M13 18 L19 6" />
          <path d="M19 6 L15 6" />
          <path d="M19 6 L19 12" />
        </svg>
      );
    case "browser":
      return (<svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="6.5" cy="7" r="0.4" fill="currentColor"/><circle cx="8.5" cy="7" r="0.4" fill="currentColor"/></svg>);
    case "play":
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>);
    case "joystick":
      return (<svg {...common}><path d="M6 9c-2 0-3 1.2-3 3.5S4 16 6 16h12c2 0 3-1.2 3-3.5S20 9 18 9z"/><circle cx="8" cy="12.5" r="1.4"/><path d="M15 11.5h2M16 10.5v2"/></svg>);
    case "manga":
      return (<svg {...common}><path d="M4 5h12l4 4v10H4z"/><path d="M16 5v4h4"/><path d="M8 13c1.5 1 4 1 6 0"/></svg>);
    case "video":
      return (<svg {...common}><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>);
    case "search":
      return (<svg {...common}><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>);
    case "command":
      return (<svg {...common}><path d="M9 6a3 3 0 1 0-3 3h3zm0 0v9m0 0a3 3 0 1 0-3 3v-3zm0 0h9m0 0a3 3 0 1 0 3-3h-3zm0 0v-9m0 0a3 3 0 1 0 3 3h-3z"/></svg>);
    case "crosshair":
      return (<svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>);
    case "pin":
      return (<svg {...common}><path d="M12 2l3 3-2 3 4 4-5 1-3 8-3-8-5-1 4-4-2-3z"/></svg>);
    case "settings":
      return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case "x":
      return (<svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>);
    case "swap":
      return (<svg {...common}><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>);
    case "sparkle":
      return (<svg {...common}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>);
    case "wand":
      return (<svg {...common}><path d="M3 21l12-12M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>);
    case "chevron-right":
      return (<svg {...common}><path d="M9 6l6 6-6 6"/></svg>);
    case "arrow-up":
      return (<svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>);
    case "arrow-down":
      return (<svg {...common}><path d="M12 5v14M5 12l7 7 7-7"/></svg>);
    case "more":
      return (<svg {...common}><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>);
    case "check":
      return (<svg {...common}><path d="M4 12l5 5 11-12"/></svg>);
    case "mic":
      return (<svg {...common}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 12a7 7 0 0 0 14 0M12 19v3"/></svg>);
    case "globe":
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>);
    case "stack":
      return (<svg {...common}><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></svg>);
    case "layers":
      return (<svg {...common}><path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/></svg>);
    case "notes":
      return (<svg {...common}><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>);
    case "memory":
      return (<svg {...common}><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M7 6V4M11 6V4M15 6V4M19 6V4M7 20v-2M11 20v-2M15 20v-2M19 20v-2"/><rect x="8" y="10" width="8" height="4"/></svg>);
    case "lock":
      return (<svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>);
    case "eye":
      return (<svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>);
    case "keyboard":
      return (<svg {...common}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>);
    default:
      return null;
  }
};

/* ── Wordmark ────────────────────────────────────────────────────
   Wordmark glyph: a stacked bracket-arrow ▸◂ inscribed in a square
*/
const Wordmark = ({ size = 22, withText = true, color, mono = false }) => {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: color || "var(--rt-fg)" }}>
      <span style={{
        position: "relative",
        width: size, height: size, borderRadius: size * 0.28,
        background: mono ? "transparent" : "linear-gradient(140deg, #8b7cff 0%, #5d4ce0 50%, #a899ff 100%)",
        boxShadow: mono ? "inset 0 0 0 1px var(--rt-line-2)" : "0 4px 12px rgba(139,124,255,0.42), inset 0 0 0 0.5px rgba(255,255,255,0.18)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path d="M5 6 L5 18 M5 6 L11 6 M11 6 L11 18" stroke={mono ? "currentColor" : "white"} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M19 6 L19 18 M19 6 L13 6 M13 6 L13 18" stroke={mono ? "currentColor" : "white"} strokeWidth="2.2" strokeLinecap="round" opacity="0.65"/>
        </svg>
      </span>
      {withText && (
        <span style={{
          fontFamily: "var(--rt-font)",
          fontWeight: 600,
          fontSize: size * 0.78,
          letterSpacing: "-0.01em",
        }}>
          RealTrans
        </span>
      )}
    </span>
  );
};

/* ── Pill / button ───────────────────────────────────────────────── */
const Pill = ({ children, accent, mono, ...rest }) => (
  <span
    {...rest}
    style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 8px",
      fontFamily: mono ? "var(--rt-mono)" : "var(--rt-font)",
      fontSize: 10.5, fontWeight: 500,
      color: accent ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
      background: accent ? "rgba(139,124,255,0.12)" : "rgba(255,255,255,0.06)",
      border: `0.5px solid ${accent ? "rgba(139,124,255,0.32)" : "var(--rt-line-2)"}`,
      borderRadius: 999, ...rest.style,
    }}
  >
    {children}
  </span>
);

/* ── tiny animated dots for "thinking" ──────────────────────────── */
const ThinkingDots = ({ color }) => (
  <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width: 4, height: 4, borderRadius: 999, background: color || "var(--rt-accent-bright)",
        animation: `rt-blink 1.2s ${i*0.15}s infinite`,
      }} />
    ))}
  </span>
);

Object.assign(window, { Icon, Wordmark, Pill, ThinkingDots });

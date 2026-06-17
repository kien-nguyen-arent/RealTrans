/* palette.jsx — Command palette: the Raycast-style entry point.
   Opens on hotkey. Always anchored top-center.
   Holds "Translate region", recent pinned regions, languages, settings.
*/

const PALETTE_COMMANDS = () => {
  const base = [
    { id: "translate-region", label: "Translate a region", sub: "Draw on screen or smart-snap to a UI element", kbd: ["Enter"], icon: "crosshair", primary: true, action: "select" },
    { id: "translate-window", label: "Translate this window", sub: "Auto-detect all text in the active window", kbd: ["⌥", "Enter"], icon: "stack", action: "translate-window" },
    { id: "pin-region", label: "Pin a region", sub: "Anchor a translation to a moving area", kbd: ["⇧", "P"], icon: "pin", action: "pin" },
  ];
  const recents = [
    { id: "recent-1", label: "Subtitle band · Crunchyroll", sub: "JA → EN · used 3 min ago · live", kbd: ["1"], icon: "play", section: "Recent", action: "recent" },
    { id: "recent-2", label: "FFXIV — main quest log", sub: "JA → EN · pinned · 4h ago", kbd: ["2"], icon: "joystick", section: "Recent", action: "recent" },
    { id: "recent-3", label: "Twitter — @yamada_d feed", sub: "JA → EN · 1d ago", kbd: ["3"], icon: "browser", section: "Recent", action: "recent" },
  ];
  const meta = [
    { id: "settings", label: "Settings…", sub: "Hotkeys, languages, appearance", icon: "settings", section: "More", action: "settings" },
    { id: "lang", label: "Change languages", sub: "Currently: 日本語 → English", icon: "swap", section: "More", action: "lang" },
  ];
  return [...base, ...recents, ...meta];
};

const Palette = ({ open, onClose, onSelect }) => {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const all = useMemo(() => PALETTE_COMMANDS(), []);
  const filtered = useMemo(() => {
    if (!q.trim()) return all;
    const s = q.toLowerCase();
    return all.filter(c => c.label.toLowerCase().includes(s) || (c.sub||"").toLowerCase().includes(s));
  }, [q, all]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => { setCursor(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(filtered.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[cursor]) onSelect(filtered[cursor]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  if (!open) return null;

  // group by section
  const groups = [];
  let cur = null;
  filtered.forEach((c, i) => {
    const section = c.section || "Suggested";
    if (!cur || cur.label !== section) {
      cur = { label: section, items: [] };
      groups.push(cur);
    }
    cur.items.push({ ...c, _i: i });
  });

  return (
    <>
      {/* dim layer */}
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)",
        backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
        animation: "rt-fade-in 0.15s var(--rt-ease) both",
        zIndex: 50,
      }} />
      <div style={{
        position: "absolute",
        top: "12%", left: "50%", transform: "translateX(-50%)",
        width: 540, zIndex: 51,
        animation: "rt-pop-in 0.22s var(--rt-ease-2) both",
      }}>
        <div className="glass-strong" style={{ borderRadius: 16, overflow: "hidden", padding: 0 }}>
          {/* search row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderBottom: "0.5px solid var(--rt-line-2)" }}>
            <Wordmark size={16} withText={false} />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search or describe what to translate…"
              style={{
                flex: 1, background: "transparent", border: 0, outline: 0,
                color: "var(--rt-fg)", fontSize: 15, fontFamily: "var(--rt-font)",
                fontWeight: 400, letterSpacing: "-0.005em",
              }}
            />
            <Pill mono>JA → EN</Pill>
            <Pill mono>Alt Q</Pill>
          </div>

          {/* results */}
          <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>
            {groups.length === 0 && (
              <div style={{ padding: "30px 14px", textAlign: "center", color: "var(--rt-fg-3)", fontSize: 13 }}>
                No matches for "{q}". Try "translate", "pin", "manga"…
              </div>
            )}
            {groups.map(g => (
              <div key={g.label}>
                <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--rt-fg-3)", textTransform: "uppercase", fontFamily: "var(--rt-mono)" }}>
                  {g.label}
                </div>
                {g.items.map(c => (
                  <PaletteRow
                    key={c.id}
                    cmd={c}
                    selected={c._i === cursor}
                    onMouseEnter={() => setCursor(c._i)}
                    onClick={() => onSelect(c)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* footer */}
          <div style={{
            display: "flex", alignItems: "center", padding: "8px 14px",
            borderTop: "0.5px solid var(--rt-line-2)",
            background: "rgba(0,0,0,0.18)",
            fontSize: 10.5, color: "var(--rt-fg-3)", gap: 14,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="kbd">↑</span><span className="kbd">↓</span> navigate
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="kbd">↵</span> select
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="kbd">esc</span> close
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="sparkle" size={11}/> AI suggested
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

const PaletteRow = ({ cmd, selected, onMouseEnter, onClick }) => {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "9px 14px", margin: "0 6px", borderRadius: 8,
        background: selected ? "rgba(139,124,255,0.16)" : "transparent",
        cursor: "default",
        transition: "background .08s var(--rt-ease)",
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: selected ? "rgba(139,124,255,0.22)" : "rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: selected ? "var(--rt-accent-bright)" : "var(--rt-fg-2)",
        border: "0.5px solid var(--rt-line-2)",
      }}>
        <Icon name={cmd.icon} size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--rt-fg)", letterSpacing: "-0.005em" }}>
          {cmd.label}
          {cmd.primary && <span style={{ marginLeft: 8, fontSize: 9, color: "var(--rt-accent-bright)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--rt-mono)" }}>Primary</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--rt-fg-3)", marginTop: 1 }}>{cmd.sub}</div>
      </div>
      {cmd.kbd && (
        <div style={{ display: "flex", gap: 3 }}>
          {cmd.kbd.map((k, i) => <span key={i} className="kbd">{k}</span>)}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { Palette });

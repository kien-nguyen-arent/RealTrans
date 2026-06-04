/* selection.jsx — Selection mode
   The "magic moment": user enters selection, the scene dims,
   smart-detected regions glow, hover snaps, drag draws free-form.

   Phases:
     1. "hover"   — show detected regions; user hovers to highlight one
     2. "drag"    — user is drawing a free-form rect
     3. "ocr"     — region locked, OCR/translation animating
     4. "ready"   — translation applied (parent dismisses selection)
*/

/* Per-scenario detected regions (in % of scene area) */
const DETECTED_REGIONS = {
  browser: [
    { id: "title-block", x: 22.5, y: 24, w: 55, h: 15, label: "Article header", auto: true },
    { id: "body", x: 22.5, y: 62, w: 55, h: 30, label: "Body · 3 paragraphs", auto: true, primary: true },
  ],
  anime: [
    { id: "sub-band", x: 8, y: 76, w: 84, h: 12, label: "Subtitle track", auto: true, primary: true, live: true },
  ],
  game: [
    { id: "dialogue", x: 8, y: 76, w: 84, h: 16, label: "Dialogue box", auto: true, primary: true, pinnable: true },
    { id: "menu", x: 81, y: 4, w: 16, h: 30, label: "Menu list", auto: true, pinnable: true },
    { id: "hp", x: 2, y: 4, w: 25, h: 14, label: "Status HUD", auto: true, pinnable: true },
  ],
  manga: [
    { id: "b1", x: 17, y: 13, w: 22, h: 11, label: "Bubble 1", auto: true },
    { id: "b2", x: 60, y: 21, w: 26, h: 13, label: "Bubble 2", auto: true },
    { id: "b3", x: 27, y: 60, w: 31, h: 17, label: "Bubble 3 (emphasis)", auto: true },
    { id: "b4", x: 65, y: 70, w: 25, h: 11, label: "Bubble 4", auto: true },
    { id: "all-bubbles", x: 16, y: 12, w: 76, h: 70, label: "All 4 bubbles", auto: true, primary: true, group: true },
  ],
  meeting: [
    { id: "caption", x: 10, y: 70, w: 80, h: 14, label: "Live caption strip", auto: true, primary: true, live: true },
  ],
};

const SelectionOverlay = ({ scenarioId, onCommit, onCancel }) => {
  const [hover, setHover] = useState(null);
  const [dragRect, setDragRect] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState("hover"); // hover | ocr
  const [locked, setLocked] = useState(null);
  const layerRef = useRef(null);

  const regions = DETECTED_REGIONS[scenarioId] || [];

  // ESC to cancel
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  // primary region — pulse it as a hint
  const primary = regions.find(r => r.primary);

  const getPct = (e) => {
    const rect = layerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onMouseDown = (e) => {
    if (hover) return; // clicking a smart region — handled in onClick
    const p = getPct(e);
    setDragging(true);
    setDragRect({ x: p.x, y: p.y, w: 0, h: 0, _startX: p.x, _startY: p.y });
  };

  const onMouseMove = (e) => {
    const p = getPct(e);
    if (dragging && dragRect) {
      const sx = dragRect._startX, sy = dragRect._startY;
      setDragRect({
        x: Math.min(sx, p.x),
        y: Math.min(sy, p.y),
        w: Math.abs(p.x - sx),
        h: Math.abs(p.y - sy),
        _startX: sx, _startY: sy,
      });
    } else {
      // find candidate region under cursor
      const hit = regions
        .filter(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)
        .sort((a, b) => (a.w * a.h) - (b.w * b.h))[0];
      setHover(hit?.id || null);
    }
  };

  const onMouseUp = () => {
    if (dragging && dragRect) {
      setDragging(false);
      if (dragRect.w > 4 && dragRect.h > 4) {
        commit({ ...dragRect, label: "Selection", id: "freeform" });
      } else {
        setDragRect(null);
      }
    }
  };

  const onClickRegion = (r) => commit(r);

  const commit = (r) => {
    setLocked(r);
    setPhase("ocr");
    setHover(null);
    // Convert %-based region to physical screen pixels for the backend.
    // layerRef gives us the element rect in CSS pixels; devicePixelRatio
    // scales to physical pixels; window.screenX/Y adds the window offset.
    setTimeout(() => {
      const layer = layerRef.current?.getBoundingClientRect();
      let screenRect = null;
      if (layer) {
        const dpr = window.devicePixelRatio || 1;
        screenRect = {
          x: Math.round((layer.left + (r.x / 100) * layer.width  + window.screenX) * dpr),
          y: Math.round((layer.top  + (r.y / 100) * layer.height + window.screenY) * dpr),
          w: Math.round((r.w / 100) * layer.width  * dpr),
          h: Math.round((r.h / 100) * layer.height * dpr),
        };
      }
      onCommit(screenRect);
    }, 1100);
  };

  // hint: keyboard tab through regions
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Tab" && phase === "hover") {
        e.preventDefault();
        const ids = regions.filter(r => r.auto).map(r => r.id);
        const i = ids.indexOf(hover);
        const next = ids[(i + 1) % ids.length];
        setHover(next);
      } else if (e.key === "Enter" && phase === "hover" && hover) {
        const r = regions.find(x => x.id === hover);
        if (r) commit(r);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [hover, phase, regions]);

  return (
    <div
      ref={layerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={(e) => {
        // if click was inside a region, commit
        if (hover && !dragging) {
          const r = regions.find(x => x.id === hover);
          if (r) onClickRegion(r);
        }
      }}
      style={{
        position: "absolute", inset: 0,
        cursor: hover ? "pointer" : "crosshair",
        userSelect: "none",
        zIndex: 30,
      }}
    >
      {/* DIM LAYER */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(6, 7, 12, 0.55)",
        pointerEvents: "none",
        animation: "rt-fade-in 0.25s var(--rt-ease) both",
      }} />

      {/* Smart-detected regions */}
      {phase === "hover" && regions.map(r => (
        <SmartRegion
          key={r.id}
          r={r}
          hovered={hover === r.id}
          primary={r.primary && !hover}
        />
      ))}

      {/* drag rect */}
      {dragRect && phase === "hover" && (
        <div style={{
          position: "absolute",
          left: `${dragRect.x}%`, top: `${dragRect.y}%`,
          width: `${dragRect.w}%`, height: `${dragRect.h}%`,
          border: "1.5px dashed var(--rt-accent-bright)",
          background: "rgba(139,124,255,0.10)",
          pointerEvents: "none",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
        }}>
          <CornerHandle pos="tl" />
          <CornerHandle pos="tr" />
          <CornerHandle pos="bl" />
          <CornerHandle pos="br" />
          <div style={{
            position: "absolute", top: -22, left: 0,
            fontSize: 10, fontFamily: "var(--rt-mono)",
            color: "var(--rt-accent-bright)",
            background: "var(--rt-bg)", padding: "2px 6px",
            borderRadius: 4, border: "0.5px solid rgba(139,124,255,0.5)",
          }}>{Math.round(dragRect.w * 14.4)}×{Math.round(dragRect.h * 9)} px</div>
        </div>
      )}

      {/* OCR animation on locked region */}
      {phase === "ocr" && locked && (
        <LockedRegionAnim r={locked} />
      )}

      {/* Top-center HUD */}
      <SelectionHUD scenarioId={scenarioId} phase={phase} regionLabel={hover ? regions.find(r=>r.id===hover)?.label : null} onCancel={onCancel} />

      {/* corner crosshair coords */}
      {phase === "hover" && hover === null && !dragging && (
        <CrosshairLabel layerRef={layerRef} />
      )}
    </div>
  );
};

const CrosshairLabel = ({ layerRef }) => {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  useEffect(() => {
    const h = (e) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, [layerRef]);

  return (
    <>
      {/* horizontal crosshair */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: `${pos.y}%`,
        height: 1, background: "rgba(139,124,255,0.4)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: `${pos.x}%`,
        width: 1, background: "rgba(139,124,255,0.4)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left: `calc(${pos.x}% + 10px)`, top: `calc(${pos.y}% + 10px)`,
        fontFamily: "var(--rt-mono)", fontSize: 10, color: "var(--rt-accent-bright)",
        background: "rgba(10,10,15,0.78)", padding: "2px 6px", borderRadius: 4,
        border: "0.5px solid rgba(139,124,255,0.4)",
        pointerEvents: "none",
      }}>{Math.round(pos.x * 14.4)}, {Math.round(pos.y * 9)}</div>
    </>
  );
};

const SmartRegion = ({ r, hovered, primary }) => {
  return (
    <div style={{
      position: "absolute",
      left: `${r.x}%`, top: `${r.y}%`,
      width: `${r.w}%`, height: `${r.h}%`,
      border: hovered ? "2px solid var(--rt-accent-bright)" : "1px dashed rgba(139,124,255,0.45)",
      background: hovered ? "rgba(139,124,255,0.16)" : "rgba(139,124,255,0.02)",
      boxShadow: hovered
        ? "0 0 0 4px rgba(139,124,255,0.18), 0 0 60px rgba(139,124,255,0.32) inset"
        : primary
          ? "0 0 0 2px rgba(139,124,255,0.20)"
          : "none",
      transition: "all 0.12s var(--rt-ease)",
      pointerEvents: "none",
      animation: primary ? "rt-glow-pulse 2.4s infinite" : undefined,
      borderRadius: 2,
    }}>
      {/* corner brackets — drawn as four small L shapes */}
      <RegionBracket pos="tl" hovered={hovered} />
      <RegionBracket pos="tr" hovered={hovered} />
      <RegionBracket pos="bl" hovered={hovered} />
      <RegionBracket pos="br" hovered={hovered} />

      {/* label */}
      {hovered && (
        <div style={{
          position: "absolute", top: -26, left: -2,
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <span style={{
            background: "var(--rt-accent)",
            color: "#fff", padding: "3px 8px",
            fontSize: 10.5, fontFamily: "var(--rt-mono)",
            borderRadius: 4, fontWeight: 600,
            letterSpacing: "0.02em",
            boxShadow: "0 2px 8px rgba(139,124,255,0.45)",
          }}>{r.label}</span>
          {r.live && <Pill mono accent style={{ background: "rgba(94,234,212,0.16)", color: "#5eead4", borderColor: "rgba(94,234,212,0.35)" }}>● live</Pill>}
          {r.pinnable && <Pill mono><Icon name="pin" size={9}/> pinnable</Pill>}
          <Pill mono>Tab to cycle</Pill>
        </div>
      )}
    </div>
  );
};

const RegionBracket = ({ pos, hovered }) => {
  const map = {
    tl: { top: -1, left: -1, borderTop: "2px", borderLeft: "2px" },
    tr: { top: -1, right: -1, borderTop: "2px", borderRight: "2px" },
    bl: { bottom: -1, left: -1, borderBottom: "2px", borderLeft: "2px" },
    br: { bottom: -1, right: -1, borderBottom: "2px", borderRight: "2px" },
  };
  const s = map[pos];
  const c = hovered ? "var(--rt-accent-bright)" : "rgba(139,124,255,0.85)";
  return (
    <div style={{
      position: "absolute", width: 10, height: 10,
      borderTopWidth: s.borderTop || 0, borderBottomWidth: s.borderBottom || 0,
      borderLeftWidth: s.borderLeft || 0, borderRightWidth: s.borderRight || 0,
      borderColor: c, borderStyle: "solid",
      top: s.top, bottom: s.bottom, left: s.left, right: s.right,
    }}/>
  );
};

const CornerHandle = ({ pos }) => {
  const m = {
    tl: { top: -3, left: -3 }, tr: { top: -3, right: -3 },
    bl: { bottom: -3, left: -3 }, br: { bottom: -3, right: -3 },
  };
  return (<div style={{
    position: "absolute", ...m[pos],
    width: 6, height: 6, background: "var(--rt-accent-bright)",
    border: "1px solid #fff", borderRadius: 2,
  }}/>);
};

const LockedRegionAnim = ({ r }) => {
  return (
    <div style={{
      position: "absolute",
      left: `${r.x}%`, top: `${r.y}%`,
      width: `${r.w}%`, height: `${r.h}%`,
      border: "2px solid var(--rt-accent-bright)",
      background: "rgba(139,124,255,0.10)",
      boxShadow: "0 0 0 4px rgba(139,124,255,0.18), 0 0 80px rgba(139,124,255,0.32)",
      borderRadius: 2,
      overflow: "hidden",
      animation: "rt-fade-in 0.2s var(--rt-ease) both",
    }}>
      {/* scanning line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: "12%",
        background: "linear-gradient(180deg, transparent 0%, rgba(139,124,255,0.55) 50%, transparent 100%)",
        animation: "rt-scan 0.9s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", left: 8, top: -28,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <Pill mono accent>
          <ThinkingDots /> OCR · {r.label}
        </Pill>
        <Pill mono>JA → EN</Pill>
      </div>
    </div>
  );
};

const SelectionHUD = ({ scenarioId, phase, regionLabel, onCancel }) => {
  const sc = SCENARIOS[scenarioId];
  return (
    <div style={{
      position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 32,
    }}>
      {/* rt-pop-in animates `transform` with fill `both`, so it must live on the
         inner surface — on the outer div it would override the centering translate. */}
      <div className="glass-strong" style={{
        padding: "8px 12px 8px 12px", borderRadius: 12, display: "flex", alignItems: "center", gap: 12,
        color: "var(--rt-fg)", fontSize: 12,
        animation: "rt-pop-in 0.2s var(--rt-ease) both",
      }}>
        <Wordmark size={14} withText={false} />
        <div style={{ width: 1, height: 16, background: "var(--rt-line-2)" }}/>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>
            {phase === "ocr" ? "Reading…" : regionLabel ? `Detected: ${regionLabel}` : "Drag, or hover a detected region"}
          </div>
          <div style={{ fontSize: 10, color: "var(--rt-fg-3)" }}>
            Mode · {sc.mode} · 日本語 → English
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span className="kbd">Tab</span>
          <span style={{ fontSize: 10, color: "var(--rt-fg-3)" }}>cycle</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span className="kbd">↵</span>
          <span style={{ fontSize: 10, color: "var(--rt-fg-3)" }}>confirm</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span className="kbd">esc</span>
          <span style={{ fontSize: 10, color: "var(--rt-fg-3)" }} onClick={onCancel}>cancel</span>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SelectionOverlay, DETECTED_REGIONS });

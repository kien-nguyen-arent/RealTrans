/* desktop.jsx — clean frame that hosts the active scenario + RealTrans overlays.
   The Windows-11 simulator (wallpaper, fake window chrome, taskbar) has been removed
   so the focus stays on RealTrans itself.
*/

const Desktop = ({ scenarioId, children }) => {
  return (
    <div className="desktop" style={{
      position: "relative",
      overflow: "hidden",
      background: "#0c0c10",
      color: "#fff",
      fontFamily: "var(--rt-font)",
    }}>
      {/* the scenario fills the whole frame; RealTrans overlays sit on top */}
      <div style={{ position: "absolute", inset: 0 }}>
        {children}
      </div>
    </div>
  );
};

Object.assign(window, { Desktop });

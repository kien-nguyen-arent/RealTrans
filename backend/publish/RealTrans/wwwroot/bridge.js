// bridge.js — thin IPC wrapper over window.chrome.webview.
// Falls back to console.debug no-ops so the UI works in a plain browser for design work.
//
// IPC contract:
//   JS → C# : postMessage(OBJECT). WebView2 serializes to JSON; C# reads
//             WebMessageAsJson and deserializes into InboundMessage record.
//   C# → JS : PostWebMessageAsJson(jsonString). WebView2 delivers e.data
//             as the PARSED object — DO NOT call JSON.parse on it.

const RealTransBridge = (() => {
  const isWebView = typeof window.chrome !== "undefined" &&
                    typeof window.chrome.webview !== "undefined";

  // ── outbound: JS → C# ────────────────────────────────────────────────────
  function send(type, payload) {
    const msg = { type, payload: payload || {} };
    if (isWebView) {
      // postMessage(object) → C# WebMessageAsJson = '{"type":...,"payload":...}'.
      // Avoid postMessage(string) which arrives wrapped as a JSON-encoded string.
      window.chrome.webview.postMessage(msg);
    } else {
      console.debug("[bridge:send]", type, payload);
    }
  }

  // ── inbound: C# → JS ─────────────────────────────────────────────────────
  const _handlers = {};

  function on(type, fn) {
    if (!_handlers[type]) _handlers[type] = [];
    _handlers[type].push(fn);
  }

  if (isWebView) {
    window.chrome.webview.addEventListener("message", (e) => {
      try {
        // PostWebMessageAsJson on the C# side delivers e.data already parsed.
        // Fall back to JSON.parse if some path delivers it as a string.
        const msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!msg || typeof msg !== "object" || !msg.type) {
          console.warn("[bridge:recv] unexpected payload", e.data);
          return;
        }
        // Outbound messages from C# are flat: { type, ...props }. Handlers
        // receive the whole object and destructure what they need.
        const fns = _handlers[msg.type];
        if (fns) fns.forEach(fn => fn(msg));
      } catch (err) {
        console.error("[bridge:recv] parse error", err, e.data);
      }
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function ready() { send("app:ready"); }

  return { send, on, ready, isWebView };
})();

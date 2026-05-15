// bridge.js — thin IPC wrapper over window.chrome.webview.
// Falls back to console.debug no-ops so the UI works in a plain browser for design work.

const RealTransBridge = (() => {
  const isWebView = typeof window.chrome !== "undefined" &&
                    typeof window.chrome.webview !== "undefined";

  // ── outbound: JS → C# ────────────────────────────────────────────────────
  function send(type, payload) {
    const msg = JSON.stringify({ type, payload: payload || {} });
    if (isWebView) {
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
        const msg = JSON.parse(e.data);
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

using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Core;
using RealTrans.Core.Bridge;
using RealTrans.Core.Configuration;
using RealTrans.Core.DPI;
using RealTrans.Overlay;
using Translumo.HotKeys;

namespace RealTrans.Shell
{
    public partial class ShellWindow : Window
    {
        private readonly WebMessageBus _bus;
        private readonly RealTransHotKeyManager _hotkeys;
        private readonly RealTransConfiguration _config;
        private readonly RegionPinCollection _pins;
        private readonly DpiHelper _dpi;
        private readonly ILogger<ShellWindow> _logger;
        private bool _selectionInFlight;

        public ShellWindow(
            WebMessageBus bus,
            RealTransHotKeyManager hotkeys,
            RealTransConfiguration config,
            RegionPinCollection pins,
            DpiHelper dpi,
            ILogger<ShellWindow> logger)
        {
            InitializeComponent();
            _bus      = bus;
            _hotkeys  = hotkeys;
            _config   = config;
            _pins     = pins;
            _dpi      = dpi;
            _logger   = logger;

            _hotkeys.OpenPalettePressed  += (_, _) => SendHotkeyFired("openPalette");
            _hotkeys.ToggleOverlayPressed += (_, _) => SendHotkeyFired("toggleOverlay");

            _bus.OutboundReady += OnOutboundMessage;
            _bus.SelectionOpen += OnSelectionOpen;
            _bus.SessionStart  += OnSessionStarted;
            _bus.SessionStop   += OnSessionStopped;

            Loaded += OnLoaded;
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            // Exclude the main shell from screen-capture APIs. Without this, a
            // user who picks a capture rect that overlaps the RealTrans window
            // (very common in the default inline render mode, where the window
            // stays visible to show Original/Translated panes) feeds the React
            // UI's pixels back into OCR. With this call the window renders as
            // black/transparent in the captured bitmap while remaining fully
            // visible to the user. Requires Windows 10 2004 — already gated by
            // the csproj's net8.0-windows10.0.19041.0 target.
            Win32OverlayHelper.ExcludeFromCapture(this);
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            _dpi.UpdateFromVisual(this);

            try
            {
                await WebView.EnsureCoreWebView2Async();
                WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                var wwwroot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                if (Directory.Exists(wwwroot))
                {
                    // Serve wwwroot as https://realtrans.local/ so Babel's XHR file
                    // loads work (file:// origin blocks XHR to sibling file:// URIs).
                    WebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "realtrans.local", wwwroot,
                        CoreWebView2HostResourceAccessKind.Allow);
                    WebView.CoreWebView2.Navigate("https://realtrans.local/RealTrans.html");
                }
                else
                {
                    _logger.LogWarning("wwwroot not found at {Path}", wwwroot);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WebView2 initialization failed");
            }
        }

        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try { _bus.Dispatch(e.WebMessageAsJson); }
            catch (Exception ex) { _logger.LogError(ex, "Failed to dispatch web message"); }
        }

        // ── Selection area ────────────────────────────────────────────────────

        private async void OnSelectionOpen(object? sender, EventArgs e)
        {
            // WebMessageReceived fires on the UI thread, so we can call Hide() directly.
            // We must hide BEFORE taking the screenshot, then wait for the compositor
            // to remove this window from the screen before capturing.
            if (!Dispatcher.CheckAccess())
            {
                await Dispatcher.InvokeAsync(() => OnSelectionOpen(sender, e));
                return;
            }

            // Re-entry guard: a second selection:open arriving while the previous
            // SelectionAreaWindow is still alive would leave two overlays on screen.
            if (_selectionInFlight)
            {
                _logger.LogDebug("selection:open ignored — previous selection still in flight");
                return;
            }
            _selectionInFlight = true;

            SelectionAreaWindow? sel = null;
            try
            {
                Hide();
                await System.Threading.Tasks.Task.Delay(200); // compositor flush

                sel = new SelectionAreaWindow();
                bool resolved = false;
                bool committed = false;

                sel.Committed += rect =>
                {
                    resolved = true;
                    committed = true;
                    _bus.Publish(new SelectionCommittedMessage(rect));
                };
                sel.SelectionCancelled += () =>
                {
                    resolved = true;
                    _bus.Publish(new SelectionCancelledMessage());
                };
                sel.Closed += (_, _) =>
                {
                    _selectionInFlight = false;
                    // Guarantee JS exits the "selecting" state even if the window
                    // was closed without firing Committed/SelectionCancelled.
                    if (!resolved)
                    {
                        _bus.Publish(new SelectionCancelledMessage());
                    }
                    // Only restore the app when the user did NOT commit a region. A
                    // committed selection starts translation; OnSessionStarted then
                    // decides visibility by render mode (inline → front; ghost/replace
                    // → minimized), so the app no longer pops up over the user's
                    // content after an overlay-mode capture.
                    if (!committed)
                    {
                        Show();
                        WindowState = WindowState.Normal;
                    }
                };

                sel.Show();
                sel.Activate();
                sel.ForceForeground(); // bypass Win32 ForegroundLockTimeout
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Selection failed to open");
                _selectionInFlight = false;
                sel?.Close();
                _bus.Publish(new SelectionCancelledMessage());
                if (!IsVisible) Show();
            }
        }

        // After a committed selection starts translation, decide how this window
        // behaves by render mode. Overlay modes (replace/ghost) paint results on
        // screen, so minimize the app to the taskbar — out of the user's way, still
        // reachable, and the global ~ hotkey can stop translation without focusing
        // it. Inline mode shows results in this window, so bring it to the front.
        private void OnSessionStarted(object? sender, InboundMessage msg)
        {
            var mode = "inline";
            try
            {
                if (msg.Payload.TryGetProperty("renderMode", out var m)
                    && m.ValueKind == JsonValueKind.String)
                    mode = m.GetString() ?? "inline";
            }
            catch { /* fall back to inline */ }

            bool inline = string.Equals(mode, "inline", StringComparison.OrdinalIgnoreCase);
            Dispatcher.Invoke(() =>
            {
                Show();
                if (inline)
                {
                    WindowState = WindowState.Normal;
                    Activate();
                }
                else
                {
                    WindowState = WindowState.Minimized;
                }
            });
        }

        // Translation stopped (Stop button, ESC, or the global ~ toggle): restore the
        // window so the user can see it stopped and start again.
        private void OnSessionStopped(object? sender, InboundMessage msg)
        {
            Dispatcher.Invoke(() =>
            {
                Show();
                WindowState = WindowState.Normal;
                Activate();
            });
        }

        // ── Outbound: C# → JS ─────────────────────────────────────────────────

        private void OnOutboundMessage(object? sender, OutboundMessage msg)
        {
            try
            {
                // CRITICAL: serialize using the RUNTIME type, not the declared
                // (abstract) parameter type. JsonSerializer.Serialize<T>(value, …)
                // infers T from the parameter (OutboundMessage here) and writes
                // ONLY base-type properties by default — every derived record's
                // payload (Rect, SourceText, Code, etc.) would be silently dropped,
                // producing `{"type":"…"}` envelopes with no data. Passing the
                // runtime type forces full serialization of the derived record.
                var json = JsonSerializer.Serialize(msg, msg.GetType(), new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });
                Dispatcher.Invoke(() => WebView.CoreWebView2?.PostWebMessageAsJson(json));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to post web message");
            }
        }

        private void SendHotkeyFired(string action)
        {
            _bus.Publish(new HotkeyFiredMessage(action));
        }

        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);
            _bus.OutboundReady -= OnOutboundMessage;
            _bus.SelectionOpen -= OnSelectionOpen;
            _bus.SessionStart  -= OnSessionStarted;
            _bus.SessionStop   -= OnSessionStopped;
        }
    }
}

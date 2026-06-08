using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Core;
using RealTrans.Core.Bridge;
using RealTrans.Core.Configuration;
using RealTrans.Core.DPI;
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

            Loaded += OnLoaded;
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

                sel.Committed += rect =>
                {
                    resolved = true;
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
                    Show();
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
        }
    }
}

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

        public ShellWindow(
            WebMessageBus bus,
            RealTransHotKeyManager hotkeys,
            RealTransConfiguration config,
            RegionPinCollection pins,
            DpiHelper dpi,
            ILogger<ShellWindow> logger)
        {
            InitializeComponent();
            _bus = bus;
            _hotkeys = hotkeys;
            _config = config;
            _pins = pins;
            _dpi = dpi;
            _logger = logger;

            _hotkeys.OpenPalettePressed += (_, _) => SendHotkeyFired("openPalette");
            _hotkeys.ToggleOverlayPressed += (_, _) => SendHotkeyFired("toggleOverlay");

            _bus.OutboundReady += OnOutboundMessage;

            Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            // Update DPI after window is realized
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

        private void OnOutboundMessage(object? sender, OutboundMessage msg)
        {
            try
            {
                var json = JsonSerializer.Serialize(msg, new JsonSerializerOptions
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
        }
    }
}

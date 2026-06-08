using System;
using System.Collections.Concurrent;
using System.Windows;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.DPI;
using RealTrans.Core.Orchestration;

namespace RealTrans.Overlay
{
    /// <summary>
    /// Owns the persistent on-screen capture indicators — one per active region.
    /// Created/destroyed by SessionManager via <see cref="ICaptureIndicatorService"/>.
    /// </summary>
    public class CaptureIndicatorService : ICaptureIndicatorService, IDisposable
    {
        private readonly DpiHelper _dpi;
        private readonly WebMessageBus _bus;
        private readonly ILogger<CaptureIndicatorService> _logger;
        private readonly ConcurrentDictionary<string, CaptureRegionIndicator> _indicators = new();

        public CaptureIndicatorService(DpiHelper dpi, WebMessageBus bus, ILogger<CaptureIndicatorService> logger)
        {
            _dpi = dpi;
            _bus = bus;
            _logger = logger;
        }

        public void Show(string regionId, RectDto rect)
        {
            var app = Application.Current;
            if (app == null)
            {
                _bus.Publish(new ErrorMessage("capture-indicator",
                    "Application.Current is null — cannot create WPF indicator window"));
                return;
            }

            try
            {
                app.Dispatcher.Invoke(() =>
                {
                    var wpfRect = _dpi.PixelsToWpf(new System.Drawing.Rectangle(rect.X, rect.Y, rect.W, rect.H));
                    var indicator = new CaptureRegionIndicator();
                    indicator.PositionAt(wpfRect.X, wpfRect.Y, wpfRect.Width, wpfRect.Height);
                    indicator.Show();

                    _bus.Publish(new StatusMessage("info",
                        $"session ▸ capture indicator visible · WPF rect ({wpfRect.X:F0},{wpfRect.Y:F0}) {wpfRect.Width:F0}×{wpfRect.Height:F0} · scale {_dpi.ScaleX:F2}x{_dpi.ScaleY:F2}"));

                    // Defensive: replace any leftover indicator from a previous session
                    // under the same regionId — Hide should have cleaned up but a crashed
                    // session could leave one behind.
                    if (_indicators.TryRemove(regionId, out var stale))
                    {
                        try { stale.Close(); } catch { /* best-effort */ }
                    }
                    _indicators[regionId] = indicator;
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to show capture indicator for {RegionId}", regionId);
                _bus.Publish(new ErrorMessage("capture-indicator",
                    $"{ex.GetType().Name}: {ex.Message}"));
            }
        }

        public void Hide(string regionId)
        {
            if (!_indicators.TryRemove(regionId, out var indicator)) return;
            try
            {
                Application.Current?.Dispatcher.Invoke(() => indicator.Close());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to hide capture indicator for {RegionId}", regionId);
            }
        }

        public void Dispose()
        {
            foreach (var key in _indicators.Keys)
                Hide(key);
        }
    }
}

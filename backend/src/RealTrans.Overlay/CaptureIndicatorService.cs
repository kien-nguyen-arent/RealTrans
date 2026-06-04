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
        private readonly ILogger<CaptureIndicatorService> _logger;
        private readonly ConcurrentDictionary<string, CaptureRegionIndicator> _indicators = new();

        public CaptureIndicatorService(DpiHelper dpi, ILogger<CaptureIndicatorService> logger)
        {
            _dpi = dpi;
            _logger = logger;
        }

        public void Show(string regionId, RectDto rect)
        {
            try
            {
                var app = Application.Current;
                if (app == null) return;
                app.Dispatcher.Invoke(() =>
                {
                    var wpfRect = _dpi.PixelsToWpf(new System.Drawing.Rectangle(rect.X, rect.Y, rect.W, rect.H));
                    var indicator = new CaptureRegionIndicator();
                    indicator.PositionAt(wpfRect.X, wpfRect.Y, wpfRect.Width, wpfRect.Height);
                    indicator.Show();

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

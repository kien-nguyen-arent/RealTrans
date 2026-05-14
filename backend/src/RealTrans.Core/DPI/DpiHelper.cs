using System.Drawing;
using System.Windows;
using System.Windows.Media;

namespace RealTrans.Core.DPI
{
    /// <summary>
    /// Converts between Win32 physical screen pixels (used by OCR/capture layer)
    /// and WPF device-independent units (used by overlay window positioning).
    ///
    /// Critical: on 150% scaling, a 1920x1080 screen is 1280x720 in WPF units.
    /// Placing an overlay at Left=1500 (pixels) without conversion would put it off-screen.
    /// </summary>
    public class DpiHelper
    {
        private double _scaleX = 1.0;
        private double _scaleY = 1.0;

        public void UpdateFromVisual(Visual visual)
        {
            var dpi = VisualTreeHelper.GetDpi(visual);
            _scaleX = dpi.DpiScaleX;
            _scaleY = dpi.DpiScaleY;
        }

        public Rect PixelsToWpf(Rectangle pixelRect) => new Rect(
            pixelRect.X / _scaleX,
            pixelRect.Y / _scaleY,
            pixelRect.Width / _scaleX,
            pixelRect.Height / _scaleY);

        public Rectangle WpfToPixels(Rect wpfRect) => new Rectangle(
            (int)(wpfRect.X * _scaleX),
            (int)(wpfRect.Y * _scaleY),
            (int)(wpfRect.Width * _scaleX),
            (int)(wpfRect.Height * _scaleY));

        public double ScaleX => _scaleX;
        public double ScaleY => _scaleY;
    }
}

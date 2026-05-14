using System.Windows;
using System.Windows.Media;

namespace RealTrans.Overlay
{
    /// <summary>
    /// Base class for all overlay windows.
    /// Always-on-top, transparent background, no taskbar entry, no title bar.
    /// Subclasses implement Show/Update/Hide for their specific render mode.
    /// </summary>
    public abstract class OverlayWindowBase : Window
    {
        protected OverlayWindowBase()
        {
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            Topmost = true;
            ShowInTaskbar = false;
            ResizeMode = ResizeMode.NoResize;
            IsHitTestVisible = false;
        }

        protected override void OnSourceInitialized(System.EventArgs e)
        {
            base.OnSourceInitialized(e);
            Win32OverlayHelper.ApplyOverlayStyle(this, clickThrough: true);
        }

        public void PositionAt(double x, double y, double width, double height)
        {
            Left = x;
            Top = y;
            Width = width;
            Height = height;
        }

        public abstract void UpdateTranslation(string translatedText, string renderMode);
    }
}

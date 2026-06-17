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
            // CRITICAL: exclude every overlay window from screen capture.
            //
            // CaptureRegionIndicator sits INSIDE the user's capture rect by
            // definition (it marks that rect), so without this exclusion the
            // dashed violet border and the "RealTrans · capturing" badge feed
            // straight back into OCR every frame and corrupt the source text.
            //
            // GhostOverlayWindow / ReplaceOverlayWindow sit on top of the
            // captured source text in non-inline render modes — without this
            // exclusion, the translated output is what OCR reads on the next
            // iteration, creating a re-translation feedback loop.
            //
            // The capture pipeline RealTrans uses (legacy Translumo
            // ScreenCapturer → Graphics.CopyFromScreen) is exactly the API
            // surface WDA_EXCLUDEFROMCAPTURE blacklists, so excluded windows
            // appear as black pixels in the captured bitmap.
            Win32OverlayHelper.ExcludeFromCapture(this);
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

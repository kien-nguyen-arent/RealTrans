using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;

namespace RealTrans.Overlay.Modes
{
    /// <summary>
    /// Replace mode: semi-opaque dark panel covers source subtitle rect,
    /// white TextBlock renders the translation in its place.
    /// No backdrop blur — flat color only (avoids WPF compositing overhead).
    /// </summary>
    public class ReplaceOverlayWindow : OverlayWindowBase
    {
        private readonly Border _background;
        private readonly TextBlock _textBlock;

        public ReplaceOverlayWindow()
        {
            _textBlock = new TextBlock
            {
                Foreground = Brushes.White,
                FontSize = 20,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(10, 6, 10, 6),
            };

            _background = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(230, 10, 10, 15)),
                CornerRadius = new CornerRadius(6),
                Child = _textBlock,
            };

            // Wrap the translation at the original text's width and grow the panel's
            // HEIGHT to fit it, rather than shrinking the font into a tight box.
            // (The old Viewbox approach put the text on one line and scaled it down
            // to the box width — a longer translation, e.g. JP→VI, became
            // microscopic.) Width + font are set per-update in PositionAt.
            SizeToContent = SizeToContent.Height;
            MinWidth = 140;
            Content = _background;
        }

        // OverlayManager hands us the OCR-detected text box. Pin top-left + width to
        // it, size the font to the original line height (clamped readable), and let
        // SizeToContent grow the height to fit the wrapped translation.
        public override void PositionAt(double x, double y, double width, double height)
        {
            if (_textBlock != null)
                _textBlock.FontSize = System.Math.Clamp(height * 0.6, 12, 24);
            Left = x;
            Top = y;
            Width = width;
        }

        public override void UpdateTranslation(string translatedText, string renderMode)
        {
            // Race guard. OverlayManager closes this window when the user switches
            // render mode (Replace → Ghost → Replace etc.) mid-session, but a
            // TranslationResultMessage already queued through the WebMessageBus
            // can still reach this method after Close(). Without this guard the
            // Invoke lambda fires on a shut-down Dispatcher and the WPF runtime
            // throws on _textBlock.Text — a NullReferenceException surfaces in
            // SessionManager's error path.
            if (Dispatcher.HasShutdownStarted || Dispatcher.HasShutdownFinished) return;
            Dispatcher.Invoke(() =>
            {
                // Belt-and-braces: even if the dispatcher is up, _textBlock /
                // _background could be null on a partially-constructed window
                // (e.g., if Window.Show() hasn't fully laid out yet).
                if (_textBlock == null || _background == null) return;

                _textBlock.Text = translatedText;

                // Fade-in on text change for visual smoothness
                var fade = new DoubleAnimation(0.0, 1.0, new Duration(System.TimeSpan.FromMilliseconds(120)));
                _background.BeginAnimation(OpacityProperty, fade);
            });
        }
    }
}

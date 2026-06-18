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
                FontSize = 14,                       // fixed normal reading size (~code-editor size)
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

            // Fixed, normal font size; wrap the translation at the original text's
            // width and grow the panel's HEIGHT to fit it. (Deriving the font from
            // the detected box height was unreliable — too big for multi-line source.)
            SizeToContent = SizeToContent.Height;
            MinWidth = 140;
            Content = _background;
        }

        // Pin the panel's top-left + width to the OCR-detected text box; the font is
        // fixed (set in the ctor) and SizeToContent grows the height to fit the
        // wrapped translation.
        public override void PositionAt(double x, double y, double width, double height)
        {
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

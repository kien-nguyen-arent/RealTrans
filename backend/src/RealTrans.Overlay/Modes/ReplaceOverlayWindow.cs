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
                FontSize = 22,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(12, 6, 12, 6),
            };

            _background = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(230, 10, 10, 15)),
                CornerRadius = new CornerRadius(6),
                Child = _textBlock,
            };

            Content = _background;
        }

        public override void UpdateTranslation(string translatedText, string renderMode)
        {
            Dispatcher.Invoke(() =>
            {
                _textBlock.Text = translatedText;

                // Fade-in on text change for visual smoothness
                var fade = new DoubleAnimation(0.0, 1.0, new Duration(System.TimeSpan.FromMilliseconds(120)));
                _background.BeginAnimation(OpacityProperty, fade);
            });
        }
    }
}

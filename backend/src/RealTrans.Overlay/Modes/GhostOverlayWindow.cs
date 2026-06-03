using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace RealTrans.Overlay.Modes
{
    /// <summary>
    /// Ghost mode: violet-tinted semi-transparent panel over the caption band
    /// with translated text superimposed.
    /// </summary>
    public class GhostOverlayWindow : OverlayWindowBase
    {
        private readonly TextBlock _textBlock;

        public GhostOverlayWindow()
        {
            _textBlock = new TextBlock
            {
                Foreground = Brushes.White,
                FontSize = 21,
                TextWrapping = TextWrapping.Wrap,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(16, 8, 16, 8),
            };

            Content = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(215, 80, 60, 200)), // violet tint
                Child = _textBlock,
            };
        }

        public override void UpdateTranslation(string translatedText, string renderMode)
        {
            Dispatcher.Invoke(() => _textBlock.Text = translatedText);
        }
    }
}

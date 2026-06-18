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
                FontSize = 14,                       // fixed normal reading size (~code-editor size)
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(12, 6, 12, 6),
            };

            // Fixed, normal font size; wrap at the original text's width and grow the
            // panel's HEIGHT to fit. (Deriving the font from the detected box height
            // was unreliable — too big for multi-line source.)
            SizeToContent = SizeToContent.Height;
            MinWidth = 140;
            Content = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(215, 80, 60, 200)), // violet tint
                Child = _textBlock,
            };
        }

        // Pin top-left + width to the OCR-detected text box; the font is fixed (set
        // in the ctor) and SizeToContent grows the height to fit the wrapped text.
        public override void PositionAt(double x, double y, double width, double height)
        {
            Left = x;
            Top = y;
            Width = width;
        }

        public override void UpdateTranslation(string translatedText, string renderMode)
        {
            // Race guard — see ReplaceOverlayWindow.UpdateTranslation for the
            // full rationale. Mid-session render-mode switches can leave a
            // TranslationResultMessage in flight that lands on the just-closed
            // window; without this guard _textBlock.Text NREs.
            if (Dispatcher.HasShutdownStarted || Dispatcher.HasShutdownFinished) return;
            Dispatcher.Invoke(() =>
            {
                if (_textBlock == null) return;
                _textBlock.Text = translatedText;
            });
        }
    }
}

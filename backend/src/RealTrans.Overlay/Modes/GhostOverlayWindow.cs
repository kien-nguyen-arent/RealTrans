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
                FontSize = 20,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(12, 6, 12, 6),
            };

            // Wrap at the original text's width and grow the panel's HEIGHT to fit,
            // instead of shrinking the font into a tight box (which made a longer
            // translation, e.g. JP→VI, microscopic). Width + font set in PositionAt.
            SizeToContent = SizeToContent.Height;
            MinWidth = 140;
            Content = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(215, 80, 60, 200)), // violet tint
                Child = _textBlock,
            };
        }

        // Pin top-left + width to the OCR-detected text box, size the font to the
        // original line height (clamped readable), and let SizeToContent grow the
        // height to fit the wrapped translation.
        public override void PositionAt(double x, double y, double width, double height)
        {
            if (_textBlock != null)
                _textBlock.FontSize = System.Math.Clamp(height * 0.72, 15, 34);
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

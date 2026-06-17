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
                FontSize = 28,                       // upper bound; the Viewbox scales down to fit
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.NoWrap,
                TextAlignment = TextAlignment.Center,
            };

            // Uniform + DownOnly: shrink the translation to fit the (tight) text box
            // matching the original's footprint, never enlarging past the base size.
            var fit = new Viewbox
            {
                Child = _textBlock,
                Stretch = Stretch.Uniform,
                StretchDirection = StretchDirection.DownOnly,
                Margin = new Thickness(10, 6, 10, 6),
            };

            Content = new Border
            {
                Background = new SolidColorBrush(Color.FromArgb(215, 80, 60, 200)), // violet tint
                Child = fit,
            };
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

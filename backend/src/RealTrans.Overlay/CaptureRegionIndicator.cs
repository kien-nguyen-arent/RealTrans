using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;

namespace RealTrans.Overlay
{
    /// <summary>
    /// Persistent on-screen marker showing the user exactly which region the OCR
    /// pipeline is polling. Lives for the duration of a translation session.
    ///
    /// Frameless, click-through (WS_EX_TRANSPARENT), always-on-top, no taskbar
    /// entry. Renders a dashed violet rectangle that matches the SelectionAreaWindow
    /// styling, plus a small "RealTrans · capturing" badge in the top-left so the
    /// indicator doesn't look like leftover UI debris.
    /// </summary>
    public sealed class CaptureRegionIndicator : OverlayWindowBase
    {
        private readonly Rectangle _border;

        public CaptureRegionIndicator()
        {
            // OverlayWindowBase already sets WindowStyle.None, AllowsTransparency,
            // Background.Transparent, Topmost, ShowInTaskbar=false, ResizeMode=NoResize,
            // IsHitTestVisible=false. OnSourceInitialized adds WS_EX_TRANSPARENT.

            var canvas = new Canvas();

            // Dashed violet border matching the SelectionAreaWindow drag rect.
            // The stroke is a mutable SolidColorBrush so we can animate its
            // Opacity (NOT the rectangle's — that would also dim the dashes
            // before the pulse hits the desired contrast).
            var strokeBrush = new SolidColorBrush(Color.FromRgb(139, 124, 255));
            _border = new Rectangle
            {
                Stroke           = strokeBrush,
                StrokeThickness  = 2,
                StrokeDashArray  = new DoubleCollection { 6, 3 },
                Fill             = Brushes.Transparent,
                IsHitTestVisible = false,
            };
            canvas.SizeChanged += (_, _) =>
            {
                _border.Width  = canvas.ActualWidth;
                _border.Height = canvas.ActualHeight;
            };
            canvas.Children.Add(_border);

            // Pulse so the user can't miss it on a busy background. 1.2s cycle,
            // opacity 0.5 ↔ 1.0, auto-reverse, forever.
            Loaded += (_, _) =>
            {
                var pulse = new DoubleAnimation
                {
                    From           = 0.55,
                    To             = 1.0,
                    Duration       = TimeSpan.FromSeconds(0.6),
                    AutoReverse    = true,
                    RepeatBehavior = RepeatBehavior.Forever,
                    EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
                };
                strokeBrush.BeginAnimation(Brush.OpacityProperty, pulse);
            };

            // Tiny badge — small enough to not obscure content, distinct enough that
            // the user knows what the rectangle is.
            var badge = new Border
            {
                Background       = new SolidColorBrush(Color.FromArgb(220, 14, 15, 22)),
                BorderBrush      = new SolidColorBrush(Color.FromArgb(110, 139, 124, 255)),
                BorderThickness  = new Thickness(0.5),
                CornerRadius     = new CornerRadius(4),
                Padding          = new Thickness(6, 2, 6, 2),
                IsHitTestVisible = false,
                Child = new TextBlock
                {
                    Text       = "RealTrans  ·  capturing",
                    Foreground = new SolidColorBrush(Color.FromArgb(230, 244, 244, 245)),
                    FontFamily = new FontFamily("Segoe UI"),
                    FontSize   = 10.5,
                },
            };
            Canvas.SetLeft(badge, 4);
            Canvas.SetTop(badge, 4);
            canvas.Children.Add(badge);

            Content = canvas;
        }

        // Unused — the indicator does not display translation results. Required by
        // OverlayWindowBase but a no-op here.
        public override void UpdateTranslation(string translatedText, string renderMode) { }
    }
}

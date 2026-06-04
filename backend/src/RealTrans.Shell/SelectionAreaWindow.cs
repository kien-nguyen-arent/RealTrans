using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using RealTrans.Core.Bridge;

namespace RealTrans.Shell
{
    /// <summary>
    /// Full-screen selection overlay.
    /// Captures a GDI screenshot before becoming visible, displays it as a frozen
    /// desktop background, and lets the user drag a rectangle to define the
    /// translation capture region.
    /// </summary>
    public sealed class SelectionAreaWindow : Window
    {
        [DllImport("user32.dll")] static extern int  GetSystemMetrics(int n);
        [DllImport("gdi32.dll")]  static extern bool DeleteObject(IntPtr h);
        [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
        [DllImport("gdi32.dll")]  static extern int   GetDeviceCaps(IntPtr hdc, int nIndex);
        [DllImport("user32.dll")] static extern int   ReleaseDC(IntPtr hwnd, IntPtr hdc);
        [DllImport("user32.dll")] static extern bool  SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern uint  GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern bool  AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
        [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] static extern bool  BringWindowToTop(IntPtr hWnd);

        private const int SM_XVIRTUALSCREEN = 76;
        private const int SM_YVIRTUALSCREEN = 77;
        private const int SM_CXVIRTUALSCREEN = 78;
        private const int SM_CYVIRTUALSCREEN = 79;
        private const int LOGPIXELSX = 88;
        private const int LOGPIXELSY = 90;

        public event Action<RectDto>? Committed;
        public event Action?          SelectionCancelled;

        private const string IdleHudText = "Drag to select the region to translate  ·  Esc to cancel";
        private static readonly Color AccentColor = Color.FromRgb(139, 124, 255);

        private readonly Canvas    _canvas;
        private readonly Rectangle _selRect;
        private readonly Border    _hudBorder;
        private readonly TextBlock _hudText;
        private readonly Border    _dimLabel;
        private readonly TextBlock _dimLabelText;
        private readonly Line      _crosshairH;
        private readonly Line      _crosshairV;
        private readonly Border    _coordLabel;
        private readonly TextBlock _coordLabelText;

        private Point  _dragStart;
        private bool   _dragging;
        private double _dpiX;
        private double _dpiY;

        public SelectionAreaWindow()
        {
            // Read system DPI before the window exists so we can set correct
            // WPF DIU bounds immediately — avoiding the "tiny transparent window"
            // that appears if bounds are deferred to OnSourceInitialized.
            (_dpiX, _dpiY) = ReadSystemDpi();

            int vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
            int vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
            int vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            int vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);

            WindowStyle   = WindowStyle.None;
            ResizeMode    = ResizeMode.NoResize;
            Topmost       = true;
            ShowInTaskbar = false;
            Cursor        = Cursors.Cross;
            Background    = Brushes.Black; // visible if screenshot fails; canvas covers it otherwise

            // Set full virtual-screen bounds in the constructor so WPF creates the
            // window at the right size — no AllowsTransparency needed since the canvas
            // background IS the screenshot (opaque).
            Left   = vx / _dpiX;
            Top    = vy / _dpiY;
            Width  = vw / _dpiX;
            Height = vh / _dpiY;

            // ── Screenshot ───────────────────────────────────────────────────────
            // Taken here, after ShellWindow has been hidden for ≥150 ms (caller's
            // responsibility), so this window does not appear in the screenshot.
            var screenshot = TakeScreenshot(vx, vy, vw, vh);

            // ── Canvas ───────────────────────────────────────────────────────────
            _canvas = new Canvas
            {
                Background = screenshot != null
                    ? (Brush)new ImageBrush(screenshot) { Stretch = Stretch.Fill }
                    : new SolidColorBrush(Color.FromRgb(10, 10, 14)),
            };

            // Dim overlay — makes the selection rect stand out
            var dim = new Rectangle
            {
                Fill             = new SolidColorBrush(Color.FromArgb(100, 0, 0, 0)),
                IsHitTestVisible = false,
            };
            _canvas.SizeChanged += (_, _) =>
            {
                dim.Width  = _canvas.ActualWidth;
                dim.Height = _canvas.ActualHeight;
            };
            _canvas.Children.Add(dim);

            // Crosshair guide lines + coordinate label — shown only when idle (not dragging),
            // so the user can judge precise boundaries before starting a drag.
            var crosshairBrush = new SolidColorBrush(Color.FromArgb(102, 139, 124, 255)); // ~40% alpha
            crosshairBrush.Freeze();
            _crosshairH = new Line
            {
                Stroke           = crosshairBrush,
                StrokeThickness  = 1,
                IsHitTestVisible = false,
                Visibility       = Visibility.Collapsed,
            };
            _crosshairV = new Line
            {
                Stroke           = crosshairBrush,
                StrokeThickness  = 1,
                IsHitTestVisible = false,
                Visibility       = Visibility.Collapsed,
            };
            _canvas.Children.Add(_crosshairH);
            _canvas.Children.Add(_crosshairV);

            _coordLabelText = new TextBlock
            {
                Foreground = new SolidColorBrush(Color.FromArgb(220, 244, 244, 245)),
                FontFamily = new FontFamily("Cascadia Mono, Consolas"),
                FontSize   = 10.5,
            };
            _coordLabel = new Border
            {
                Background       = new SolidColorBrush(Color.FromArgb(190, 14, 15, 22)),
                BorderBrush      = new SolidColorBrush(Color.FromArgb(70, 139, 124, 255)),
                BorderThickness  = new Thickness(0.5),
                CornerRadius     = new CornerRadius(4),
                Padding          = new Thickness(6, 2, 6, 2),
                IsHitTestVisible = false,
                Visibility       = Visibility.Collapsed,
                Child            = _coordLabelText,
            };
            _canvas.Children.Add(_coordLabel);

            // Selection rectangle.
            // Fill alpha reduced 45 → 25 to match the prototype's rgba(139,124,255,0.10).
            _selRect = new Rectangle
            {
                Stroke           = new SolidColorBrush(AccentColor),
                StrokeThickness  = 2,
                StrokeDashArray  = new DoubleCollection { 6, 3 },
                Fill             = new SolidColorBrush(Color.FromArgb(25, 139, 124, 255)),
                Visibility       = Visibility.Hidden,
                IsHitTestVisible = false,
            };
            _canvas.Children.Add(_selRect);

            // Dimension label — small monospace pill that follows the top-left of the
            // drag rect, showing live W×H px so the user can size the region precisely.
            _dimLabelText = new TextBlock
            {
                Foreground = new SolidColorBrush(Color.FromArgb(240, 244, 244, 245)),
                FontFamily = new FontFamily("Cascadia Mono, Consolas"),
                FontSize   = 10.5,
                FontWeight = FontWeights.Medium,
            };
            _dimLabel = new Border
            {
                Background       = new SolidColorBrush(Color.FromArgb(230, 14, 15, 22)),
                BorderBrush      = new SolidColorBrush(Color.FromArgb(110, 139, 124, 255)),
                BorderThickness  = new Thickness(0.5),
                CornerRadius     = new CornerRadius(4),
                Padding          = new Thickness(6, 2, 6, 2),
                IsHitTestVisible = false,
                Visibility       = Visibility.Collapsed,
                Child            = _dimLabelText,
            };
            _canvas.Children.Add(_dimLabel);

            // HUD pill
            _hudText = new TextBlock
            {
                Text       = IdleHudText,
                Foreground = new SolidColorBrush(Color.FromArgb(230, 244, 244, 245)),
                FontSize   = 13,
                FontFamily = new FontFamily("Segoe UI"),
            };
            _hudBorder = new Border
            {
                Background       = new SolidColorBrush(Color.FromArgb(220, 14, 15, 22)),
                BorderBrush      = new SolidColorBrush(Color.FromArgb(80, 139, 124, 255)),
                BorderThickness  = new Thickness(0.5),
                CornerRadius     = new CornerRadius(10),
                Padding          = new Thickness(16, 9, 16, 9),
                IsHitTestVisible = false,
                Child            = _hudText,
            };
            _hudBorder.SizeChanged += CenterHud;
            _canvas.SizeChanged    += CenterHud;
            _canvas.Children.Add(_hudBorder);

            Content = _canvas;

            _canvas.MouseDown  += OnMouseDown;
            _canvas.MouseMove  += OnMouseMove;
            _canvas.MouseUp    += OnMouseUp;
            _canvas.MouseLeave += OnCanvasMouseLeave;
            PreviewKeyDown     += OnKeyDown;
            Loaded             += OnLoaded;
        }

        // 0.25s fade-in matches the prototype's --rt-ease (cubic-bezier(0.22, 1, 0.36, 1)).
        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            var fade = new DoubleAnimation
            {
                From           = 0.0,
                To             = 1.0,
                Duration       = TimeSpan.FromMilliseconds(250),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            };
            BeginAnimation(OpacityProperty, fade);
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            // Refine DPI from the actual HWND in case it differs from system DPI
            // (per-monitor DPI setups).  Used for pixel conversion on mouse-up.
            var ps = PresentationSource.FromVisual(this);
            if (ps?.CompositionTarget is { } ct)
            {
                _dpiX = ct.TransformToDevice.M11;
                _dpiY = ct.TransformToDevice.M22;
            }
        }

        /// <summary>
        /// Bypass Windows' ForegroundLockTimeout protection by briefly attaching to
        /// the foreground thread's input queue, then calling SetForegroundWindow.
        /// Required for selection overlay to reliably receive mouse + Esc after
        /// ShellWindow.Hide() — without this the window appears but stays inactive.
        /// </summary>
        public void ForceForeground()
        {
            try
            {
                var helper = new WindowInteropHelper(this);
                IntPtr hWnd = helper.Handle;
                if (hWnd == IntPtr.Zero) return;

                IntPtr foreHandle = GetForegroundWindow();
                uint foreThread = GetWindowThreadProcessId(foreHandle, IntPtr.Zero);
                uint thisThread = GetCurrentThreadId();

                if (foreThread != thisThread)
                {
                    AttachThreadInput(foreThread, thisThread, true);
                    try
                    {
                        BringWindowToTop(hWnd);
                        SetForegroundWindow(hWnd);
                    }
                    finally
                    {
                        // Always detach, even if the calls above throw, so a failure here
                        // can't leave the thread input queues attached and cause system-wide
                        // focus/input glitches.
                        AttachThreadInput(foreThread, thisThread, false);
                    }
                }
                else
                {
                    BringWindowToTop(hWnd);
                    SetForegroundWindow(hWnd);
                }

                Focus();
                Keyboard.Focus(this);
            }
            catch
            {
                // best-effort — never let foreground activation crash the app
            }
        }

        // ── DPI ──────────────────────────────────────────────────────────────────

        private static (double x, double y) ReadSystemDpi()
        {
            IntPtr hdc = GetDC(IntPtr.Zero);
            try
            {
                int px = GetDeviceCaps(hdc, LOGPIXELSX);
                int py = GetDeviceCaps(hdc, LOGPIXELSY);
                return (px / 96.0, py / 96.0);
            }
            finally { ReleaseDC(IntPtr.Zero, hdc); }
        }

        // ── Screenshot ───────────────────────────────────────────────────────────

        private static BitmapSource? TakeScreenshot(int vx, int vy, int vw, int vh)
        {
            try
            {
                if (vw <= 0 || vh <= 0) return null;

                using var bmp = new System.Drawing.Bitmap(vw, vh,
                    System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                using var g = System.Drawing.Graphics.FromImage(bmp);
                g.CopyFromScreen(vx, vy, 0, 0,
                    new System.Drawing.Size(vw, vh),
                    System.Drawing.CopyPixelOperation.SourceCopy);

                IntPtr hbmp = bmp.GetHbitmap();
                try
                {
                    return Imaging.CreateBitmapSourceFromHBitmap(
                        hbmp, IntPtr.Zero, Int32Rect.Empty,
                        BitmapSizeOptions.FromEmptyOptions());
                }
                finally { DeleteObject(hbmp); }
            }
            catch { return null; }
        }

        // ── HUD positioning ──────────────────────────────────────────────────────

        private void CenterHud(object? s = null, EventArgs? e = null)
        {
            if (_canvas.ActualWidth > 0 && _hudBorder.ActualWidth > 0)
                Canvas.SetLeft(_hudBorder, (_canvas.ActualWidth - _hudBorder.ActualWidth) / 2.0);
            Canvas.SetTop(_hudBorder, 20);
        }

        // ── Mouse handlers ───────────────────────────────────────────────────────

        private void OnMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.LeftButton != MouseButtonState.Pressed) return;
            _dragStart          = e.GetPosition(_canvas);
            _dragging           = true;
            _selRect.Visibility = Visibility.Visible;
            _dimLabel.Visibility    = Visibility.Visible;
            _crosshairH.Visibility  = Visibility.Collapsed;
            _crosshairV.Visibility  = Visibility.Collapsed;
            _coordLabel.Visibility  = Visibility.Collapsed;
            _canvas.CaptureMouse();
            e.Handled = true;
        }

        private void OnMouseMove(object sender, MouseEventArgs e)
        {
            var p = e.GetPosition(_canvas);
            if (_dragging)
            {
                UpdateSelRect(_dragStart, p);
                UpdateDimensionLabel(_dragStart, p);
                UpdateHudForDrag(_dragStart, p);
            }
            else
            {
                UpdateCrosshair(p);
            }
        }

        private void OnCanvasMouseLeave(object sender, MouseEventArgs e)
        {
            if (_dragging) return;
            _crosshairH.Visibility = Visibility.Collapsed;
            _crosshairV.Visibility = Visibility.Collapsed;
            _coordLabel.Visibility = Visibility.Collapsed;
        }

        private void OnMouseUp(object sender, MouseButtonEventArgs e)
        {
            if (!_dragging) return;
            _dragging = false;
            _canvas.ReleaseMouseCapture();

            var    p = e.GetPosition(_canvas);
            double x = Math.Min(_dragStart.X, p.X);
            double y = Math.Min(_dragStart.Y, p.Y);
            double w = Math.Abs(p.X - _dragStart.X);
            double h = Math.Abs(p.Y - _dragStart.Y);

            if (w < 20 || h < 10)
            {
                _selRect.Visibility  = Visibility.Hidden;
                _dimLabel.Visibility = Visibility.Collapsed;
                _hudText.Text        = IdleHudText;
                return;
            }

            // Convert WPF DIUs → physical screen pixels, offset by virtual-screen origin
            int originX = GetSystemMetrics(SM_XVIRTUALSCREEN);
            int originY = GetSystemMetrics(SM_YVIRTUALSCREEN);

            var rect = new RectDto(
                (int)Math.Round(x * _dpiX) + originX,
                (int)Math.Round(y * _dpiY) + originY,
                (int)Math.Round(w * _dpiX),
                (int)Math.Round(h * _dpiY));

            Committed?.Invoke(rect);
            Close();
        }

        private void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                SelectionCancelled?.Invoke();
                Close();
            }
        }

        private void UpdateSelRect(Point a, Point b)
        {
            double x = Math.Min(a.X, b.X);
            double y = Math.Min(a.Y, b.Y);
            Canvas.SetLeft(_selRect, x);
            Canvas.SetTop(_selRect, y);
            _selRect.Width  = Math.Max(0, Math.Abs(b.X - a.X));
            _selRect.Height = Math.Max(0, Math.Abs(b.Y - a.Y));
        }

        // Dimension label sits 4px above the top-left of the rect, in physical pixels
        // (W×H reflect the screen-space size the user will get on commit).
        private void UpdateDimensionLabel(Point a, Point b)
        {
            double x = Math.Min(a.X, b.X);
            double y = Math.Min(a.Y, b.Y);
            double w = Math.Abs(b.X - a.X);
            double h = Math.Abs(b.Y - a.Y);
            int    px = (int)Math.Round(w * _dpiX);
            int    py = (int)Math.Round(h * _dpiY);
            _dimLabelText.Text = $"{px} × {py} px";

            // Defer the position update until after measure so ActualWidth/Height are known.
            _dimLabel.UpdateLayout();
            double labelX = x;
            double labelY = y - _dimLabel.ActualHeight - 4;
            if (labelY < 0) labelY = y + 4; // flip below the rect if it would clip the top
            Canvas.SetLeft(_dimLabel, labelX);
            Canvas.SetTop(_dimLabel, labelY);
        }

        private void UpdateHudForDrag(Point a, Point b)
        {
            double w  = Math.Abs(b.X - a.X);
            double h  = Math.Abs(b.Y - a.Y);
            int    px = (int)Math.Round(w * _dpiX);
            int    py = (int)Math.Round(h * _dpiY);
            _hudText.Text = $"{px} × {py} px  ·  Release to commit  ·  Esc to cancel";
        }

        // Crosshair = two thin lines across the canvas at the cursor, plus an "X, Y px"
        // label offset 10px from the cursor (so it doesn't sit under the pointer).
        private void UpdateCrosshair(Point p)
        {
            _crosshairH.X1 = 0;
            _crosshairH.X2 = _canvas.ActualWidth;
            _crosshairH.Y1 = p.Y;
            _crosshairH.Y2 = p.Y;
            _crosshairV.X1 = p.X;
            _crosshairV.X2 = p.X;
            _crosshairV.Y1 = 0;
            _crosshairV.Y2 = _canvas.ActualHeight;

            // Physical-pixel coords, offset by virtual-screen origin — matches what
            // the user actually selects on commit.
            int originX = GetSystemMetrics(SM_XVIRTUALSCREEN);
            int originY = GetSystemMetrics(SM_YVIRTUALSCREEN);
            int physX = (int)Math.Round(p.X * _dpiX) + originX;
            int physY = (int)Math.Round(p.Y * _dpiY) + originY;
            _coordLabelText.Text = $"{physX}, {physY} px";

            _coordLabel.UpdateLayout();
            double labelX = p.X + 10;
            double labelY = p.Y + 10;
            if (labelX + _coordLabel.ActualWidth > _canvas.ActualWidth)
                labelX = p.X - _coordLabel.ActualWidth - 10;
            if (labelY + _coordLabel.ActualHeight > _canvas.ActualHeight)
                labelY = p.Y - _coordLabel.ActualHeight - 10;
            Canvas.SetLeft(_coordLabel, labelX);
            Canvas.SetTop(_coordLabel, labelY);

            _crosshairH.Visibility = Visibility.Visible;
            _crosshairV.Visibility = Visibility.Visible;
            _coordLabel.Visibility = Visibility.Visible;
        }
    }
}

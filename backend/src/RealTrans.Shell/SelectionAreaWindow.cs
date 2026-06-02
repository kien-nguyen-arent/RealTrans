using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
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

        private readonly Canvas    _canvas;
        private readonly Rectangle _selRect;
        private readonly Border    _hudBorder;

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

            // Selection rectangle
            _selRect = new Rectangle
            {
                Stroke           = new SolidColorBrush(Color.FromRgb(139, 124, 255)),
                StrokeThickness  = 2,
                StrokeDashArray  = new DoubleCollection { 6, 3 },
                Fill             = new SolidColorBrush(Color.FromArgb(45, 139, 124, 255)),
                Visibility       = Visibility.Hidden,
                IsHitTestVisible = false,
            };
            _canvas.Children.Add(_selRect);

            // HUD pill
            _hudBorder = new Border
            {
                Background       = new SolidColorBrush(Color.FromArgb(220, 14, 15, 22)),
                BorderBrush      = new SolidColorBrush(Color.FromArgb(80, 139, 124, 255)),
                BorderThickness  = new Thickness(0.5),
                CornerRadius     = new CornerRadius(10),
                Padding          = new Thickness(16, 9, 16, 9),
                IsHitTestVisible = false,
                Child = new TextBlock
                {
                    Text       = "Drag to select the region to translate  ·  Esc to cancel",
                    Foreground = new SolidColorBrush(Color.FromArgb(230, 244, 244, 245)),
                    FontSize   = 13,
                    FontFamily = new FontFamily("Segoe UI"),
                },
            };
            _hudBorder.SizeChanged += CenterHud;
            _canvas.SizeChanged    += CenterHud;
            _canvas.Children.Add(_hudBorder);

            Content = _canvas;

            _canvas.MouseDown += OnMouseDown;
            _canvas.MouseMove += OnMouseMove;
            _canvas.MouseUp   += OnMouseUp;
            PreviewKeyDown    += OnKeyDown;
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
                    BringWindowToTop(hWnd);
                    SetForegroundWindow(hWnd);
                    AttachThreadInput(foreThread, thisThread, false);
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
            _canvas.CaptureMouse();
            e.Handled = true;
        }

        private void OnMouseMove(object sender, MouseEventArgs e)
        {
            if (!_dragging) return;
            UpdateSelRect(_dragStart, e.GetPosition(_canvas));
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
                _selRect.Visibility = Visibility.Hidden;
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
    }
}

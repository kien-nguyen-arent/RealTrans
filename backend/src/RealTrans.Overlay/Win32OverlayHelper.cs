using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace RealTrans.Overlay
{
    /// <summary>
    /// Win32 helpers for RealTrans WPF windows:
    /// <list type="bullet">
    ///   <item>WS_EX_TRANSPARENT / WS_EX_NOACTIVATE / WS_EX_LAYERED — click-through + no focus steal.</item>
    ///   <item>WDA_EXCLUDEFROMCAPTURE — hides the window from screen-capture APIs while keeping it visible to the user.</item>
    /// </list>
    /// </summary>
    public static class Win32OverlayHelper
    {
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_NOACTIVATE = 0x08000000;

        // Window display-affinity flag, Windows 10 2004 (build 19041) and newer.
        // Causes DXGI / GDI / PrintWindow / Windows.Graphics.Capture to render the
        // window as black/transparent in captured frames. RealTrans's csproj already
        // targets net8.0-windows10.0.19041.0 so this constant is always supported.
        private const uint WDA_EXCLUDEFROMCAPTURE = 0x11;

        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hwnd, int index);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint dwAffinity);

        public static void ApplyOverlayStyle(Window window, bool clickThrough = true)
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero) return;

            int style = GetWindowLong(hwnd, GWL_EXSTYLE);
            style |= WS_EX_LAYERED | WS_EX_NOACTIVATE;

            if (clickThrough)
                style |= WS_EX_TRANSPARENT;
            else
                style &= ~WS_EX_TRANSPARENT;

            SetWindowLong(hwnd, GWL_EXSTYLE, style);
        }

        public static void SetClickThrough(Window window, bool clickThrough)
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero) return;

            int style = GetWindowLong(hwnd, GWL_EXSTYLE);
            if (clickThrough)
                style |= WS_EX_TRANSPARENT;
            else
                style &= ~WS_EX_TRANSPARENT;

            SetWindowLong(hwnd, GWL_EXSTYLE, style);
        }

        /// <summary>
        /// Hides the window from screen-capture APIs (DXGI Desktop Duplication,
        /// GDI <c>BitBlt</c>/<c>PrintWindow</c>, <c>Graphics.CopyFromScreen</c>,
        /// <c>Windows.Graphics.Capture</c>) while leaving it visible on screen.
        /// The captured frame renders the window as black pixels.
        ///
        /// Used so RealTrans's own UI (main shell, capture-region indicator,
        /// translation overlays) does not feed back into the OCR pipeline when
        /// the user picks a capture region that overlaps any of them — and so
        /// the user can safely overlap the capture rect with the app window in
        /// the default inline render mode.
        ///
        /// Requires Windows 10 2004 (build 19041). The host returns false on
        /// older builds; we intentionally ignore the return value because there
        /// is no graceful fallback — without this API, RealTrans cannot avoid
        /// capturing itself, and the project's csproj already gates on this
        /// version via <c>net8.0-windows10.0.19041.0</c>.
        ///
        /// Call from <c>OnSourceInitialized</c>; the HWND is not valid earlier.
        /// </summary>
        public static void ExcludeFromCapture(Window window)
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero) return;
            SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        }
    }
}

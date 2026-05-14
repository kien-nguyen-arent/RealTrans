using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace RealTrans.Overlay
{
    /// <summary>
    /// Toggles WS_EX_TRANSPARENT (click-through) and ensures WS_EX_NOACTIVATE (no focus steal).
    /// Call SetClickThrough(true) for Replace/Ghost modes; SetClickThrough(false) for Card mode.
    /// </summary>
    public static class Win32OverlayHelper
    {
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_NOACTIVATE = 0x08000000;

        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hwnd, int index);

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

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
    }
}

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Input;
using System.Windows.Interop;

namespace Translumo.HotKeys
{
    public class HotKey : IDisposable
    {
        private static Dictionary<int, HotKey> _dictHotKeyToCalBackProc;

        [DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, UInt32 fsModifiers, UInt32 vlc);

        [DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        public const int WmHotKey = 0x0312;

        private bool _disposed = false;

        public Key Key { get; private set; }
        public KeyModifier KeyModifiers { get; private set; }
        public Action Action { get; private set; }
        public int Id { get; set; }
        public bool Registered { get; private set; }
        public bool Suspended { get; private set; } = false;

        public HotKey(Key k, KeyModifier keyModifiers, Action action, bool register = true)
        {
            Key = k;
            KeyModifiers = keyModifiers;
            Action = action;
            if (register)
            {
                Register();
            }
        }

        public void Reassign(Key k, KeyModifier keyModifiers, bool forceSuspend = false)
        {
            Unregister();
            Key = k;
            KeyModifiers = keyModifiers;
            Register(forceSuspend);
        }

        public bool Register(bool forceSuspend = false)
        {
            if (forceSuspend)
            {
                Suspended = false;
            }

            if (Registered || Suspended)
            {
                return false;
            }

            int virtualKeyCode = KeyInterop.VirtualKeyFromKey(Key);
            Id = virtualKeyCode + ((int)KeyModifiers * 0x10000);
            bool result = RegisterHotKey(IntPtr.Zero, Id, (UInt32)KeyModifiers, (UInt32)virtualKeyCode);

            if (_dictHotKeyToCalBackProc == null)
            {
                _dictHotKeyToCalBackProc = new Dictionary<int, HotKey>();
                ComponentDispatcher.ThreadFilterMessage += ComponentDispatcherThreadFilterMessage;
            }

            _dictHotKeyToCalBackProc.Add(Id, this);
            Registered = result;

            return result;
        }

        public void Suspend()
        {
            Suspended = true;
            Unregister();
        }

        public void Unregister()
        {
            if (_dictHotKeyToCalBackProc != null && _dictHotKeyToCalBackProc.TryGetValue(Id, out _))
            {
                Registered = !UnregisterHotKey(IntPtr.Zero, Id);
                _dictHotKeyToCalBackProc.Remove(Id);
            }
            else
            {
                Registered = false;
            }
        }

        private static void ComponentDispatcherThreadFilterMessage(ref MSG msg, ref bool handled)
        {
            if (!handled && msg.message == WmHotKey)
            {
                if (_dictHotKeyToCalBackProc != null &&
                    _dictHotKeyToCalBackProc.TryGetValue((int)msg.wParam, out HotKey hotKey))
                {
                    hotKey.Action?.Invoke();
                    handled = true;
                }
            }
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing) Unregister();
                _disposed = true;
            }
        }
    }

    [Flags]
    public enum KeyModifier
    {
        None = 0x0000,
        Alt = 0x0001,
        Ctrl = 0x0002,
        NoRepeat = 0x4000,
        Shift = 0x0004,
        Win = 0x0008
    }
}

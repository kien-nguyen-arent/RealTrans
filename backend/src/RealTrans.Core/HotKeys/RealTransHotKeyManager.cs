using System;
using System.Windows.Input;

namespace Translumo.HotKeys
{
    /// <summary>
    /// Manages the two RealTrans-specific global hotkeys.
    /// Deliberately thin — no gamepad, no full HotKeysServiceManager machinery.
    /// </summary>
    public class RealTransHotKeyManager : IDisposable
    {
        public event EventHandler? OpenPalettePressed;
        public event EventHandler? ToggleOverlayPressed;

        private HotKey? _paletteKey;
        private HotKey? _overlayKey;

        private HotKeyInfo _paletteKeyInfo;
        private HotKeyInfo _overlayKeyInfo;

        public RealTransHotKeyManager()
        {
            _paletteKeyInfo = new HotKeyInfo(Key.Space, KeyModifier.Ctrl | KeyModifier.Alt);
            _overlayKeyInfo = new HotKeyInfo(Key.Oem3, KeyModifier.None); // ~ key
        }

        public void RegisterAll()
        {
            _paletteKey = new HotKey(_paletteKeyInfo.Key, _paletteKeyInfo.KeyModifier,
                () => OpenPalettePressed?.Invoke(this, EventArgs.Empty));
            _overlayKey = new HotKey(_overlayKeyInfo.Key, _overlayKeyInfo.KeyModifier,
                () => ToggleOverlayPressed?.Invoke(this, EventArgs.Empty));
        }

        public void UpdatePaletteKey(Key key, KeyModifier modifier)
        {
            _paletteKeyInfo = new HotKeyInfo(key, modifier);
            _paletteKey?.Reassign(key, modifier);
        }

        public void UpdateOverlayKey(Key key, KeyModifier modifier)
        {
            _overlayKeyInfo = new HotKeyInfo(key, modifier);
            _overlayKey?.Reassign(key, modifier);
        }

        public void UnregisterAll()
        {
            _paletteKey?.Unregister();
            _overlayKey?.Unregister();
        }

        public void Dispose()
        {
            _paletteKey?.Dispose();
            _overlayKey?.Dispose();
        }
    }
}

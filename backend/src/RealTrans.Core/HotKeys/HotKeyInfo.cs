using System.Windows.Input;

namespace Translumo.HotKeys
{
    public class HotKeyInfo
    {
        public Key Key { get; set; }
        public KeyModifier KeyModifier { get; set; }

        public HotKeyInfo(Key key, KeyModifier keyModifier)
        {
            Key = key;
            KeyModifier = keyModifier;
        }

        public HotKeyInfo() { }

        public override bool Equals(object obj)
        {
            var other = obj as HotKeyInfo;
            return other != null && Key == other.Key && KeyModifier == other.KeyModifier;
        }

        public override string ToString()
        {
            var keyStr = Key == Key.Oem3 ? "~" : Key.ToString();
            return KeyModifier == KeyModifier.None ? keyStr : KeyModifier.ToString() + "+" + keyStr;
        }
    }
}

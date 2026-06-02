using System;
using System.Text.Json;

namespace RealTrans.Core.Bridge
{
    /// <summary>
    /// Central dispatcher for WebView2 ↔ C# communication.
    /// ShellWindow subscribes to OutboundReady and calls PostWebMessageAsJson.
    /// ShellWindow calls Dispatch() for every inbound message from WebMessageReceived.
    /// </summary>
    public class WebMessageBus
    {
        public event EventHandler<OutboundMessage>? OutboundReady;
        public event EventHandler<InboundMessage>? SessionStart;
        public event EventHandler<InboundMessage>? SessionStop;
        public event EventHandler<InboundMessage>? RegionDetect;
        public event EventHandler<InboundMessage>? RegionPin;
        public event EventHandler<InboundMessage>? RegionUnpin;
        public event EventHandler<InboundMessage>? SettingsGet;
        public event EventHandler<InboundMessage>? SettingsSet;
        public event EventHandler<InboundMessage>? HotkeyReassign;
        public event EventHandler? AppReady;
        public event EventHandler? SelectionOpen;

        public void Dispatch(string json)
        {
            InboundMessage msg;
            try
            {
                // WebView2 quirk: postMessage(string) on the JS side delivers
                // WebMessageAsJson as a JSON-encoded string ("\"{...}\""). Unwrap
                // once so InboundMessage deserialization succeeds either way.
                using (var doc = JsonDocument.Parse(json))
                {
                    if (doc.RootElement.ValueKind == JsonValueKind.String)
                    {
                        json = doc.RootElement.GetString() ?? "";
                    }
                }

                msg = JsonSerializer.Deserialize<InboundMessage>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
            }
            catch
            {
                return;
            }

            switch (msg.Type)
            {
                case "app:ready":       AppReady?.Invoke(this, EventArgs.Empty); break;
                case "selection:open":  SelectionOpen?.Invoke(this, EventArgs.Empty); break;
                case "session:start":  SessionStart?.Invoke(this, msg); break;
                case "session:stop":   SessionStop?.Invoke(this, msg); break;
                case "region:detect":  RegionDetect?.Invoke(this, msg); break;
                case "region:pin":     RegionPin?.Invoke(this, msg); break;
                case "region:unpin":   RegionUnpin?.Invoke(this, msg); break;
                case "settings:get":   SettingsGet?.Invoke(this, msg); break;
                case "settings:set":   SettingsSet?.Invoke(this, msg); break;
                case "hotkey:reassign": HotkeyReassign?.Invoke(this, msg); break;
            }
        }

        public void Publish(OutboundMessage message) =>
            OutboundReady?.Invoke(this, message);
    }
}

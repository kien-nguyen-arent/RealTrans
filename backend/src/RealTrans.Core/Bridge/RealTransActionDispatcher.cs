using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using System.Windows;
using Translumo.Infrastructure.Dispatching;

namespace RealTrans.Core.Bridge
{
    /// <summary>
    /// Implementation of <see cref="IActionDispatcher"/> for RealTrans.
    /// The legacy <c>TranslatorFactory</c> requires this dependency injected even
    /// when the chosen translator (e.g. Google) doesn't use it — only the Yandex
    /// translator actually dispatches actions through it. Mirrors the legacy
    /// Translumo <c>InteractionActionDispatcher</c> so existing call sites work
    /// unchanged. Lives in RealTrans.Core because the original lives in the
    /// legacy <c>Translumo</c> WPF project which we don't reference.
    /// </summary>
    public class RealTransActionDispatcher : IActionDispatcher
    {
        private readonly ConcurrentDictionary<string, object> _consumers = new();

        public void RegisterConsumer<TArgument, TResult>(string actionName, Func<TArgument, Task<TResult>> actionHandler)
        {
            if (_consumers.ContainsKey(actionName))
                throw new InvalidOperationException($"Action consumer with key '{actionName}' is already registered");
            _consumers[actionName] = actionHandler;
        }

        public async Task<TResult> DispatchActionAsync<TArgument, TResult>(string actionName, TArgument argument)
        {
            if (!_consumers.TryGetValue(actionName, out var raw))
                throw new ArgumentException("Consumer key mismatch", nameof(actionName));
            if (raw is not Func<TArgument, Task<TResult>> targetFunc)
                throw new ArgumentException("Consumer action signature mismatch", nameof(argument));

            // The legacy implementation marshals onto the WPF UI dispatcher.
            // Mirror that — some consumers (Yandex's token refresh) touch
            // WebView2 / UI state and need to be on the UI thread.
            var app = Application.Current;
            if (app == null) return await targetFunc(argument);
            return await await app.Dispatcher.InvokeAsync(() => targetFunc(argument));
        }
    }
}

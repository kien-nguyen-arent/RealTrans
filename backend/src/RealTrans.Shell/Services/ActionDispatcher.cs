using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using System.Windows;
using Translumo.Infrastructure.Dispatching;

namespace RealTrans.Shell.Services
{
    /// <summary>
    /// Minimal <see cref="IActionDispatcher"/> for the RealTrans shell.
    ///
    /// Mirrors the legacy Translumo <c>InteractionActionDispatcher</c> (which lives in the
    /// unreferenced Translumo WPF app project): it stores named action consumers and runs
    /// them on the WPF UI thread. <see cref="Translumo.Translation.TranslatorFactory"/>
    /// requires it; in practice only the Yandex translator dispatches actions
    /// (e.g. captcha interaction), so for the default translators this is effectively inert.
    ///
    /// Registering this fixes "session-start-failed: Unable to resolve service for type
    /// IActionDispatcher while attempting to activate TranslatorFactory".
    /// </summary>
    public class ActionDispatcher : IActionDispatcher
    {
        private readonly ConcurrentDictionary<string, object> _consumers = new();

        public void RegisterConsumer<TArgument, TResult>(string actionName, Func<TArgument, Task<TResult>> actionHandler)
        {
            if (!_consumers.TryAdd(actionName, actionHandler))
                throw new InvalidOperationException($"Action consumer with key '{actionName}' is already registered");
        }

        public async Task<TResult> DispatchActionAsync<TArgument, TResult>(string actionName, TArgument argument)
        {
            if (!_consumers.TryGetValue(actionName, out var consumer))
                throw new ArgumentException("Consumer key mismatch", nameof(actionName));
            if (consumer is not Func<TArgument, Task<TResult>> targetFunc)
                throw new ArgumentException("Consumer action signature mismatch", nameof(argument));

            var dispatcher = Application.Current?.Dispatcher;
            return dispatcher == null
                ? await targetFunc(argument)
                : await dispatcher.Invoke(() => targetFunc(argument));
        }
    }
}

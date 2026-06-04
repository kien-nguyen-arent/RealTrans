using System;
using System.Timers;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// One-shot timer that fires once if no translation result has arrived
    /// within a fixed window after session start. Surfaces a status message so
    /// the user is not stuck on "Waiting for text…" forever when OCR runs but
    /// finds no readable text in the selected region (low contrast, no text
    /// present, language pack mismatch the probe didn't catch, etc.).
    /// </summary>
    public class NoResultWatchdog : IDisposable
    {
        private readonly Timer _timer;
        public event EventHandler? Elapsed;

        public NoResultWatchdog(double timeoutMs = 6000)
        {
            _timer = new Timer(timeoutMs) { AutoReset = false };
            _timer.Elapsed += (_, _) => Elapsed?.Invoke(this, EventArgs.Empty);
        }

        /// <summary>Start (or restart) the countdown. Call on session start.</summary>
        public void Start()
        {
            _timer.Stop();
            _timer.Start();
        }

        /// <summary>Cancel — call when the first translation result arrives, or on stop.</summary>
        public void Cancel() => _timer.Stop();

        public void Dispose() => _timer.Dispose();
    }
}

using System;
using System.Timers;

namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Keeps the last translation visible for a hold duration after the subtitle disappears.
    /// Prevents the overlay from flickering off between subtitle lines.
    /// </summary>
    public class SubtitleHoldTimer : IDisposable
    {
        private readonly Timer _timer;
        public event EventHandler? HoldExpired;

        public SubtitleHoldTimer(double holdMs = 600)
        {
            _timer = new Timer(holdMs) { AutoReset = false };
            _timer.Elapsed += (_, _) => HoldExpired?.Invoke(this, EventArgs.Empty);
        }

        public void Restart()
        {
            _timer.Stop();
            _timer.Start();
        }

        public void Cancel() => _timer.Stop();

        public void Dispose() => _timer.Dispose();
    }
}

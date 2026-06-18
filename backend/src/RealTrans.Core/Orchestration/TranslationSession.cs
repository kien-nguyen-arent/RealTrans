using System;
using System.Drawing;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.Stabilization;
using Translumo.Configuration;
using Translumo.Processing;
using Translumo.Processing.Interfaces;

namespace RealTrans.Core.Orchestration
{
    /// <summary>
    /// Owns one processing service + stabilization stack for a single active region.
    /// Created/destroyed by SessionManager as regions are activated/deactivated.
    /// </summary>
    public class TranslationSession : IDisposable
    {
        public string RegionId { get; }
        public RectangleF CaptureRect { get; }

        private readonly IProcessingService _processingService;
        private readonly FrameDiffer _frameDiffer;
        private readonly StabilizationEngine _stabilization;
        private readonly SubtitleHoldTimer _holdTimer;
        private readonly NoResultWatchdog _noResultWatchdog;
        private readonly WebMessageBus _bus;
        private readonly TranslationSequencer _sequencer;
        private readonly ILogger<TranslationSession> _logger;

        private uint _lastApplied;
        private volatile bool _firstResultSeen;
        // Tracks whether the previous frame was "moving" so OnFrameMotion publishes a
        // hide exactly once per scroll (on the still→moving edge), not ~12×/second.
        private bool _lastFrameMoving;

        public TranslationSession(
            string regionId,
            RectangleF captureRect,
            IProcessingService processingService,
            WebMessageBus bus,
            TranslationSequencer sequencer,
            ILogger<TranslationSession> logger)
        {
            RegionId = regionId;
            CaptureRect = captureRect;
            _processingService = processingService;
            _bus = bus;
            _sequencer = sequencer;
            _logger = logger;
            _frameDiffer = new FrameDiffer();
            // Stabilization N=1: translate on the FIRST OCR read whose text differs
            // from the previous one. The class default (2) is anti-flicker tuning
            // for animated game subtitle rendering — useful when text fades in over
            // 100-200 ms — but for RealTrans's primary use case (reading static
            // text on screen and scrolling between sections), it adds an extra
            // IterationDelayOverrideMs of dead time after every settled change
            // without any benefit. Cost: an occasional duplicate translation if
            // the OCR read flickers between two values mid-scroll; the React feed
            // de-dupes the visual.
            _stabilization = new StabilizationEngine(requiredConsecutiveFrames: 1);
            _holdTimer = new SubtitleHoldTimer(600);
            _holdTimer.HoldExpired += OnHoldExpired;
            // 6s window before we tell the user nothing's coming through — long enough
            // that healthy first translations (sub-second after stability lock) easily
            // beat it, short enough that "no text in region" doesn't feel like a hang.
            _noResultWatchdog = new NoResultWatchdog(6000);
            _noResultWatchdog.Elapsed += OnNoResultTimeout;
            _bus.OutboundReady += OnOutboundReady;
        }

        /// <summary>
        /// Gate evaluated by TranslationProcessingService after primary OCR.
        /// Requires N consecutive identical OCR frames before allowing a translation call.
        /// </summary>
        public bool IsStable(string text) => _stabilization.IsStable(text);

        /// <summary>
        /// Motion gate evaluated by TranslationProcessingService on the raw captured frame,
        /// BEFORE OCR. Returns true only when the frame is "settled" (≈ identical to the
        /// previous one), so OCR runs on a clean, stationary frame. While the region is
        /// changing (the user scrolling), returns false to skip OCR and — on the first
        /// moving frame — hides the overlay so a stale translation doesn't float over the
        /// content sliding underneath it.
        ///
        /// FrameDiffer.IsSimilarToPrevious returns false on the very first frame and rewrites
        /// its baseline every call, so when scrolling stops there's a one-iteration (~one
        /// poll) delay before the now-stationary frame matches its predecessor and OCR fires.
        /// That delay is desirable: it guarantees OCR sees a fully-settled frame, not the
        /// first half-painted one.
        /// </summary>
        public bool ShouldProcessFrame(byte[] frame)
        {
            bool settled = _frameDiffer.IsSimilarToPrevious(frame);
            OnFrameMotion(moving: !settled);
            return settled;
        }

        // Publishes a hide exactly once on the still→moving transition. The matching
        // "show" is NOT published here — it rides the next OverlayUpdateMessage when the
        // frame settles, so the overlay reappears already carrying fresh text.
        private void OnFrameMotion(bool moving)
        {
            if (moving == _lastFrameMoving) return;
            _lastFrameMoving = moving;
            if (moving)
                _bus.Publish(new OverlayVisibilityMessage(RegionId, Visible: false));
        }

        public void Start()
        {
            _stabilization.Reset();
            _frameDiffer.Reset();
            _lastFrameMoving = false;
            _holdTimer.Cancel();
            _firstResultSeen = false;
            _noResultWatchdog.Start();
            _processingService.StartProcessing();
            _logger.LogDebug("Session started for region {RegionId}", RegionId);
        }

        public void Stop()
        {
            _processingService.StopProcessing();
            _holdTimer.Cancel();
            _noResultWatchdog.Cancel();
            _logger.LogDebug("Session stopped for region {RegionId}", RegionId);
        }

        public void Dispose()
        {
            _bus.OutboundReady -= OnOutboundReady;
            _holdTimer.HoldExpired -= OnHoldExpired;
            _noResultWatchdog.Elapsed -= OnNoResultTimeout;
            Stop();
            _holdTimer.Dispose();
            _noResultWatchdog.Dispose();
            (_processingService as IDisposable)?.Dispose();
        }

        // Restart the hold timer whenever a translation for our region is published,
        // so the overlay stays visible while text keeps arriving and only fades out
        // after a quiet period (HoldExpired → TranslationClearedMessage).
        private void OnOutboundReady(object? sender, OutboundMessage msg)
        {
            if (msg is TranslationResultMessage result && result.RegionId == RegionId)
            {
                _firstResultSeen = true;
                _noResultWatchdog.Cancel();
                _holdTimer.Restart();
            }
        }

        private void OnHoldExpired(object? sender, EventArgs e)
        {
            _bus.Publish(new TranslationClearedMessage(RegionId));
        }

        private void OnNoResultTimeout(object? sender, EventArgs e)
        {
            if (_firstResultSeen) return;
            _logger.LogInformation("No translation result within watchdog window for region {RegionId}", RegionId);
            _bus.Publish(new StatusMessage(
                "warn",
                "No text detected in the selected region after 6s. Try a region with clearly visible text, or confirm the source-language OCR pack is installed (Settings → Time & Language → Language → Optional features → Optical character recognition)."));
        }
    }
}

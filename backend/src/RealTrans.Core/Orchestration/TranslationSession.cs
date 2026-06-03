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
        private readonly WebMessageBus _bus;
        private readonly TranslationSequencer _sequencer;
        private readonly ILogger<TranslationSession> _logger;

        private uint _lastApplied;

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
            _stabilization = new StabilizationEngine();
            _holdTimer = new SubtitleHoldTimer(600);
            _holdTimer.HoldExpired += OnHoldExpired;
            _bus.OutboundReady += OnOutboundReady;
        }

        /// <summary>
        /// Gate evaluated by TranslationProcessingService after primary OCR.
        /// Requires N consecutive identical OCR frames before allowing a translation call.
        /// </summary>
        public bool IsStable(string text) => _stabilization.IsStable(text);

        public void Start()
        {
            _stabilization.Reset();
            _holdTimer.Cancel();
            _processingService.StartProcessing();
            _logger.LogDebug("Session started for region {RegionId}", RegionId);
        }

        public void Stop()
        {
            _processingService.StopProcessing();
            _holdTimer.Cancel();
            _logger.LogDebug("Session stopped for region {RegionId}", RegionId);
        }

        public void Dispose()
        {
            _bus.OutboundReady -= OnOutboundReady;
            _holdTimer.HoldExpired -= OnHoldExpired;
            Stop();
            _holdTimer.Dispose();
            (_processingService as IDisposable)?.Dispose();
        }

        // Restart the hold timer whenever a translation for our region is published,
        // so the overlay stays visible while text keeps arriving and only fades out
        // after a quiet period (HoldExpired → TranslationClearedMessage).
        private void OnOutboundReady(object? sender, OutboundMessage msg)
        {
            if (msg is TranslationResultMessage result && result.RegionId == RegionId)
            {
                _holdTimer.Restart();
            }
        }

        private void OnHoldExpired(object? sender, EventArgs e)
        {
            _bus.Publish(new TranslationClearedMessage(RegionId));
        }
    }
}

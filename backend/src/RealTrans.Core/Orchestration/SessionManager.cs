using System;
using System.Collections.Concurrent;
using System.Drawing;
using System.Linq;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.Modes.CaptionMode;
using RealTrans.Core.Regions;
using RealTrans.Core.Stabilization;
using Translumo.Configuration;
using Translumo.Processing;
using Translumo.Processing.Interfaces;

namespace RealTrans.Core.Orchestration
{
    /// <summary>
    /// Manages active TranslationSession instances. One session per active region.
    /// </summary>
    public class SessionManager : IDisposable
    {
        private readonly IServiceProvider _services;
        private readonly WebMessageBus _bus;
        private readonly TranslationSequencer _sequencer;
        private readonly WebTranslationResultSink _sink;
        private readonly ILogger<SessionManager> _logger;
        private readonly ConcurrentDictionary<string, TranslationSession> _sessions = new();
        private readonly CaptionRegionDetector _captionDetector = new();

        public SessionManager(
            IServiceProvider services,
            WebMessageBus bus,
            TranslationSequencer sequencer,
            WebTranslationResultSink sink,
            ILogger<SessionManager> logger)
        {
            _services = services;
            _bus = bus;
            _sequencer = sequencer;
            _sink = sink;
            _logger = logger;

            _bus.SessionStart += OnSessionStart;
            _bus.SessionStop += OnSessionStop;
            _bus.RegionDetect += OnRegionDetect;
        }

        private void OnSessionStart(object? sender, InboundMessage msg)
        {
            try
            {
                var scenarioId = msg.Payload.GetProperty("scenarioId").GetString() ?? "caption";
                var renderMode = msg.Payload.GetProperty("renderMode").GetString() ?? "replace";
                var regionsEl = msg.Payload.GetProperty("regions");

                foreach (var regionEl in regionsEl.EnumerateArray())
                {
                    var id = regionEl.GetProperty("id").GetString()!;
                    var rect = new RectangleF(
                        regionEl.GetProperty("x").GetSingle(),
                        regionEl.GetProperty("y").GetSingle(),
                        regionEl.GetProperty("w").GetSingle(),
                        regionEl.GetProperty("h").GetSingle());

                    StartSession(id, rect, renderMode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start session");
                _bus.Publish(new ErrorMessage("session-start-failed", ex.Message));
            }
        }

        private void OnSessionStop(object? sender, InboundMessage msg)
        {
            StopAllSessions();
        }

        private void OnRegionDetect(object? sender, InboundMessage msg)
        {
            try
            {
                var scenarioId = msg.Payload.GetProperty("scenarioId").GetString() ?? "caption";
                var screenRect = msg.Payload.GetProperty("screenRect");
                var area = new System.Drawing.Rectangle(
                    screenRect.GetProperty("x").GetInt32(),
                    screenRect.GetProperty("y").GetInt32(),
                    screenRect.GetProperty("w").GetInt32(),
                    screenRect.GetProperty("h").GetInt32());

                var regions = _captionDetector.DetectRegions(area)
                    .Select(r => new RegionDto(
                        r.Id, r.Label,
                        r.PixelRect.X, r.PixelRect.Y, r.PixelRect.Width, r.PixelRect.Height,
                        r.IsAuto, r.IsPrimary, r.IsLive, r.IsPinnable))
                    .ToList();

                _bus.Publish(new RegionsDetectedMessage(scenarioId, regions));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Region detection failed");
                _bus.Publish(new ErrorMessage("region-detect-failed", ex.Message));
            }
        }

        private void StartSession(string regionId, RectangleF captureRect, string renderMode)
        {
            StopSession(regionId);

            var rectDto = new RectDto(
                (int)captureRect.X, (int)captureRect.Y,
                (int)captureRect.Width, (int)captureRect.Height);
            _sink.RegisterRegion(regionId, rectDto, renderMode);

            var processingService = _services.GetRequiredService<IProcessingService>();

            var sessionLogger = _services.GetRequiredService<ILogger<TranslationSession>>();
            var session = new TranslationSession(
                regionId, captureRect, processingService, _bus, _sequencer, sessionLogger);

            if (processingService is TranslationProcessingService tps)
            {
                tps.RegionId = regionId;
                // Per-session capture rect so the OCR loop captures this region directly,
                // instead of the (never-set) singleton ScreenCaptureConfiguration.CaptureArea
                // which would otherwise throw "Capture area is not selected" every iteration.
                tps.CaptureArea = captureRect;
                tps.IterationDelayOverrideMs = 120;
                // Pixel-level gate (before OCR): skip the OCR/translate pipeline entirely while the
                // captured region is visually unchanged, so a static subtitle costs almost no CPU.
                tps.FrameCheck = session.ShouldProcessFrame;
                // Text-level gate (after OCR): require N consecutive identical OCR frames before
                // paying for a translation.
                tps.StabilityCheck = session.IsStable;
            }

            _sessions[regionId] = session;
            session.Start();
            _bus.Publish(new TranslationStartedMessage(regionId));
        }

        public void StopSession(string regionId)
        {
            if (_sessions.TryRemove(regionId, out var session))
            {
                _sink.UnregisterRegion(regionId);
                session.Dispose();
            }
        }

        public void StopAllSessions()
        {
            foreach (var key in _sessions.Keys.ToArray())
                StopSession(key);
        }

        public void Dispose() => StopAllSessions();
    }
}

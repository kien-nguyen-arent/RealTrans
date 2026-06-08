using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.Modes.CaptionMode;
using RealTrans.Core.Regions;
using RealTrans.Core.Stabilization;
using Translumo.Configuration;
using Translumo.Infrastructure.Language;
using Translumo.OCR.Configuration;
using Translumo.OCR.EasyOCR;
using Translumo.OCR.Tesseract;
using Translumo.OCR.WindowsOCR;
using Translumo.Processing;
using Translumo.Processing.Interfaces;
using Translumo.Translation;
using Translumo.Translation.Configuration;

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
        private readonly OcrGeneralConfiguration _ocrCfg;
        private readonly TranslationConfiguration _translationCfg;
        private readonly LanguageService _languages;
        private readonly ICaptureIndicatorService _captureIndicator;
        private readonly ILogger<SessionManager> _logger;
        private readonly ConcurrentDictionary<string, TranslationSession> _sessions = new();
        private readonly CaptionRegionDetector _captionDetector = new();

        public SessionManager(
            IServiceProvider services,
            WebMessageBus bus,
            TranslationSequencer sequencer,
            WebTranslationResultSink sink,
            OcrGeneralConfiguration ocrCfg,
            TranslationConfiguration translationCfg,
            LanguageService languages,
            ICaptureIndicatorService captureIndicator,
            ILogger<SessionManager> logger)
        {
            _services = services;
            _bus = bus;
            _sequencer = sequencer;
            _sink = sink;
            _ocrCfg = ocrCfg;
            _translationCfg = translationCfg;
            _languages = languages;
            _captureIndicator = captureIndicator;
            _logger = logger;

            _bus.SessionStart += OnSessionStart;
            _bus.SessionStop += OnSessionStop;
            _bus.RegionDetect += OnRegionDetect;
            _bus.SettingsSet += OnSettingsSet;
            _bus.AppReady    += OnAppReady;
        }

        // Send a snapshot of current translation settings so the JS UI can match
        // whatever the C# side wound up with after ConfigurationStorage.LoadConfiguration
        // (which may have overwritten our DI defaults with persisted user values).
        private void OnAppReady(object? sender, EventArgs e)
        {
            try
            {
                _bus.Publish(BuildSettingsState());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to publish settings:state on app:ready");
            }
        }

        private SettingsStateMessage BuildSettingsState()
        {
            var engines = new Dictionary<string, bool>
            {
                ["WindowsOCR"] = _ocrCfg.GetConfiguration<WindowsOCRConfiguration>()?.Enabled ?? false,
                ["Tesseract"]  = _ocrCfg.GetConfiguration<TesseractOCRConfiguration>()?.Enabled ?? false,
                ["EasyOCR"]    = _ocrCfg.GetConfiguration<EasyOCRConfiguration>()?.Enabled ?? false,
            };
            return new SettingsStateMessage(
                SourceLang: _translationCfg.TranslateFromLang.ToString(),
                TargetLang: _translationCfg.TranslateToLang.ToString(),
                Translator: _translationCfg.Translator.ToString(),
                OcrEngines: engines);
        }

        // Inbound { translateFromLang?, translateToLang?, translator?, ocrEngines? }
        // — applied live to the shared singletons. The legacy
        // TranslationProcessingService subscribes to PropertyChanged on these and
        // rebuilds OCR engines / translator instances on every change, so all of
        // these take effect mid-session without needing a restart.
        private void OnSettingsSet(object? sender, InboundMessage msg)
        {
            try
            {
                bool changed = false;
                if (msg.Payload.TryGetProperty("translateFromLang", out var fromEl)
                    && fromEl.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var name = fromEl.GetString();
                    if (Enum.TryParse<Languages>(name, ignoreCase: true, out var fromLang)
                        && fromLang != _translationCfg.TranslateFromLang)
                    {
                        _translationCfg.TranslateFromLang = fromLang;
                        _bus.Publish(new StatusMessage("info", $"settings ▸ source language → {fromLang}"));
                        changed = true;
                    }
                }
                if (msg.Payload.TryGetProperty("translateToLang", out var toEl)
                    && toEl.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var name = toEl.GetString();
                    if (Enum.TryParse<Languages>(name, ignoreCase: true, out var toLang)
                        && toLang != _translationCfg.TranslateToLang)
                    {
                        _translationCfg.TranslateToLang = toLang;
                        _bus.Publish(new StatusMessage("info", $"settings ▸ target language → {toLang}"));
                        changed = true;
                    }
                }
                if (msg.Payload.TryGetProperty("translator", out var translatorEl)
                    && translatorEl.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var name = translatorEl.GetString();
                    if (Enum.TryParse<Translators>(name, ignoreCase: true, out var translator)
                        && translator != _translationCfg.Translator)
                    {
                        _translationCfg.Translator = translator;
                        _bus.Publish(new StatusMessage("info", $"settings ▸ translator → {translator}"));
                        changed = true;
                    }
                }
                if (msg.Payload.TryGetProperty("ocrEngines", out var enginesEl)
                    && enginesEl.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    foreach (var prop in enginesEl.EnumerateObject())
                    {
                        if (prop.Value.ValueKind != System.Text.Json.JsonValueKind.True
                            && prop.Value.ValueKind != System.Text.Json.JsonValueKind.False) continue;
                        bool enable = prop.Value.GetBoolean();

                        // EasyOCR requires an embedded Python 3.8 distribution at
                        // <AppDir>\Python\ which we don't bundle. The DI registration
                        // of PythonEngineWrapper is an uninitialized stub — actually
                        // CONSTRUCTING an EasyOCREngine would NPE inside the legacy
                        // factory. Reject with a clear instruction instead of letting
                        // it explode mid-session.
                        if (prop.Name == "EasyOCR" && enable)
                        {
                            _bus.Publish(new ErrorMessage("easyocr-unavailable",
                                "EasyOCR requires an embedded Python 3.8 distribution at <AppDir>\\Python\\ which is not bundled with this build. Use WindowsOCR or Tesseract."));
                            continue;
                        }

                        OcrConfiguration? cfg = prop.Name switch
                        {
                            "WindowsOCR" => _ocrCfg.GetConfiguration<WindowsOCRConfiguration>(),
                            "Tesseract"  => _ocrCfg.GetConfiguration<TesseractOCRConfiguration>(),
                            "EasyOCR"    => _ocrCfg.GetConfiguration<EasyOCRConfiguration>(),
                            _ => null,
                        };
                        if (cfg != null && cfg.Enabled != enable)
                        {
                            cfg.Enabled = enable;
                            _bus.Publish(new StatusMessage("info",
                                $"settings ▸ {prop.Name} {(enable ? "enabled" : "disabled")}"));
                            changed = true;
                        }
                    }
                    // Guardrail: if the user disabled all engines, the next session
                    // would fail with [no-ocr-engine]. Re-enable WindowsOCR and tell
                    // them — better UX than silent failure.
                    if (!_ocrCfg.OcrConfigurations.Any(c => c.Enabled))
                    {
                        _ocrCfg.GetConfiguration<WindowsOCRConfiguration>().Enabled = true;
                        _bus.Publish(new StatusMessage("warn",
                            "At least one OCR engine must be enabled — re-enabled WindowsOCR."));
                    }
                }
                if (!changed)
                {
                    _bus.Publish(new StatusMessage("info", "settings ▸ no change"));
                }
                // Echo the new state so the UI can reconcile (e.g. when the
                // guardrail re-enabled WindowsOCR after a clear-all).
                _bus.Publish(BuildSettingsState());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to apply settings");
                _bus.Publish(new ErrorMessage("settings-apply", $"{ex.GetType().Name}: {ex.Message}"));
            }
        }

        private void OnSessionStart(object? sender, InboundMessage msg)
        {
            try
            {
                _bus.Publish(new StatusMessage("info", "session ▸ received session:start IPC"));
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
            // Stop EVERY prior session, not just the one with this regionId. The user
            // typically expects "press ` to re-pick the area" to fully replace the
            // current session — if the new region ID happens to match the old one
            // (JS hardcodes "caption-band" today), StopSession(regionId) was enough,
            // but a future scenario that uses a different ID would orphan the old
            // session. StopAllSessions handles both cases.
            //
            // The teardown path (TranslationSession.Dispose → processingService
            // .Dispose → ScreenDXCapturer.Dispose) used to race the capture thread
            // and surface as NullReferenceException; ScreenDXCapturer now snapshots
            // its DXGI handles into locals and throws CaptureException cleanly when
            // the dispose races a frame acquisition.
            StopAllSessions();

            // Granular checkpoint StatusMessages around each step so the user can
            // see EXACTLY where the pipeline dies — silent forever-stuck is the
            // symptom we're killing here.

            // Step 1: OCR readiness probe.
            _bus.Publish(new StatusMessage("info", $"session ▸ probe checking {_translationCfg.TranslateFromLang}"));
            var sourceDescriptor = _languages.GetLanguageDescriptor(_translationCfg.TranslateFromLang);
            OcrLanguageReadiness readiness;
            try
            {
                readiness = OcrLanguageProbe.Check(_ocrCfg, sourceDescriptor);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OcrLanguageProbe threw");
                _bus.Publish(new ErrorMessage("probe-threw", $"{ex.GetType().Name}: {ex.Message}"));
                return;
            }
            if (!readiness.Ready)
            {
                _logger.LogWarning("OCR readiness check failed: {Code} {Message}", readiness.Code, readiness.Message);
                _bus.Publish(new ErrorMessage(readiness.Code!, readiness.Message!));
                return;
            }
            _bus.Publish(new StatusMessage("info", "session ▸ probe ok"));

            // Step 2: Region registration.
            var rectDto = new RectDto(
                (int)captureRect.X, (int)captureRect.Y,
                (int)captureRect.Width, (int)captureRect.Height);
            _sink.RegisterRegion(regionId, rectDto, renderMode);
            _bus.Publish(new StatusMessage("info", $"session ▸ registering region {regionId} at ({rectDto.X},{rectDto.Y}) {rectDto.W}×{rectDto.H}px"));

            // Step 3: Capture indicator. Failures here used to be silent (try/catch
            // → LogWarning only) — now they surface as ErrorMessage in the feed.
            _bus.Publish(new StatusMessage("info", $"session ▸ showing capture indicator at ({rectDto.X},{rectDto.Y}) {rectDto.W}×{rectDto.H}px"));
            try
            {
                _captureIndicator.Show(regionId, rectDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CaptureIndicator.Show threw");
                _bus.Publish(new ErrorMessage("capture-indicator", $"{ex.GetType().Name}: {ex.Message}"));
                // Don't abort — the session can still run without the indicator.
            }

            // Step 4: Resolve processing service.
            _bus.Publish(new StatusMessage("info", "session ▸ resolving processing service"));
            IProcessingService processingService;
            try
            {
                processingService = _services.GetRequiredService<IProcessingService>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to resolve IProcessingService");
                _bus.Publish(new ErrorMessage("resolve-processing-service",
                    $"{ex.GetType().Name}: {ex.Message}"));
                _captureIndicator.Hide(regionId);
                return;
            }

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
                // 80 ms ≈ 12.5 Hz OCR polling. Was 120 ms; lower value reduces the
                // gap between "user finished scrolling" and "translation visible".
                // WindowsOCR on a small capture region takes ~30-50 ms per call,
                // so the loop comfortably fits within the budget. Lower than ~60
                // ms starts saturating the OCR thread without proportional benefit.
                tps.IterationDelayOverrideMs = 80;
                // Require N consecutive identical OCR frames before paying for a
                // translation. Set to 1 in TranslationSession's stabilization
                // engine for snappier response (see comment there).
                tps.StabilityCheck = session.IsStable;
            }

            // Step 5: Kick off the loop.
            _bus.Publish(new StatusMessage("info", "session ▸ start processing"));
            _sessions[regionId] = session;
            try
            {
                session.Start();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "session.Start() threw");
                _bus.Publish(new ErrorMessage("session-start", $"{ex.GetType().Name}: {ex.Message}"));
                _sessions.TryRemove(regionId, out _);
                _captureIndicator.Hide(regionId);
                return;
            }
            _bus.Publish(new StatusMessage("info", $"session ▸ ready (region={regionId})"));
            _bus.Publish(new TranslationStartedMessage(regionId));
        }

        public void StopSession(string regionId)
        {
            if (_sessions.TryRemove(regionId, out var session))
            {
                _sink.UnregisterRegion(regionId);
                session.Dispose();
            }
            _captureIndicator.Hide(regionId);
        }

        public void StopAllSessions()
        {
            foreach (var key in _sessions.Keys.ToArray())
                StopSession(key);
        }

        public void Dispose()
        {
            _bus.SessionStart -= OnSessionStart;
            _bus.SessionStop -= OnSessionStop;
            _bus.RegionDetect -= OnRegionDetect;
            _bus.SettingsSet -= OnSettingsSet;
            _bus.AppReady    -= OnAppReady;
            StopAllSessions();
        }
    }
}

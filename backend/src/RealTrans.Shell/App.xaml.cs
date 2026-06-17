using System;
using System.Linq;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Bridge;
using RealTrans.Core.Configuration;
using RealTrans.Core.DPI;
using RealTrans.Core.Orchestration;
using RealTrans.Core.Stabilization;
using RealTrans.Overlay;
using Translumo.Processing.TextProcessing;
using RealTrans.Shell.Configuration;
using Serilog;
using Serilog.Events;
using Translumo.Configuration;
using Translumo.Infrastructure.Dispatching;
using Translumo.Infrastructure.Encryption;
using Translumo.Infrastructure.Language;
using Translumo.Infrastructure.MachineLearning;
using Translumo.Infrastructure.Python;
using Translumo.OCR;
using Translumo.OCR.Configuration;
using Translumo.OCR.WindowsOCR;
using Translumo.Processing;
using Translumo.Processing.Configuration;
using Translumo.Processing.Interfaces;
using Translumo.Processing.TextProcessing;
using Translumo.Services;
using Translumo.Translation;
using Translumo.Translation.Configuration;
using Translumo.TTS;
using Translumo.Utils;
using ILogger = Microsoft.Extensions.Logging.ILogger;

namespace RealTrans.Shell
{
    public partial class App : Application
    {
        private readonly ServiceProvider _serviceProvider;
        private readonly ILogger _logger;

        public App()
        {
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Verbose()
                .WriteTo.File("Logs/log.txt", LogEventLevel.Information,
                    rollingInterval: RollingInterval.Day, retainedFileCountLimit: 10)
                .CreateLogger();

            var services = new ServiceCollection();
            ConfigureServices(services);
            _serviceProvider = services.BuildServiceProvider();
            _logger = _serviceProvider.GetRequiredService<ILogger<App>>();

            DispatcherUnhandledException += (_, e) =>
                _logger.LogCritical(e.Exception, "Unhandled dispatcher exception");
            AppDomain.CurrentDomain.UnhandledException += (_, e) =>
                _logger.LogCritical(e.ExceptionObject as Exception, "Unhandled domain exception");
        }

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            var configStorage = _serviceProvider.GetRequiredService<ConfigurationStorage>();
            configStorage.LoadConfiguration();

            // One-time defaults migration. A persisted settings file written before
            // this build was created from the legacy Translumo defaults (EN→RU +
            // DeepL + all OCR engines disabled). After ConfigurationStorage.LoadConfiguration
            // applies that to our DI singletons, the user gets EN→RU with no OCR —
            // not what RealTrans wants. Bumping DefaultsSchemaVersion is the signal
            // that this app has already applied the RealTrans defaults at least once;
            // a missing/zero value means we're starting from a Translumo-shaped file
            // (or no file at all) and need to overwrite the translation + OCR config
            // with the RealTrans presets the user actually wants.
            var rtCfg  = _serviceProvider.GetRequiredService<RealTransConfiguration>();
            var trCfg  = _serviceProvider.GetRequiredService<TranslationConfiguration>();
            var ocrCfg = _serviceProvider.GetRequiredService<OcrGeneralConfiguration>();
            if (rtCfg.DefaultsSchemaVersion < 1)
            {
                trCfg.TranslateFromLang = Languages.English;
                trCfg.TranslateToLang   = Languages.Vietnamese;
                trCfg.Translator        = Translators.Google;
                foreach (var c in ocrCfg.OcrConfigurations) c.Enabled = false;
                ocrCfg.GetConfiguration<WindowsOCRConfiguration>().Enabled = true;
                rtCfg.DefaultsSchemaVersion = 1;
                _logger.LogInformation("Applied RealTrans defaults migration (v1): EN→VI, Google, WindowsOCR.");
            }

            // Sanity check that survives even AFTER migration — a future user could
            // legitimately disable all engines via the sidebar; the next launch must
            // not lock them out. Independent of the schema migration above.
            if (!ocrCfg.OcrConfigurations.Any(c => c.Enabled))
            {
                ocrCfg.GetConfiguration<WindowsOCRConfiguration>().Enabled = true;
                _logger.LogInformation("No OCR engine enabled in persisted config — forced WindowsOCR on.");
            }

            var hotkeys = _serviceProvider.GetRequiredService<Translumo.HotKeys.RealTransHotKeyManager>();
            hotkeys.RegisterAll();

            // Eagerly resolve the bus subscribers. SessionManager and OverlayManager
            // subscribe to WebMessageBus events in their constructors — if we leave
            // them to lazy resolution, the container never builds them and the bus
            // fires `session:start` / `overlay:update` to zero subscribers. The
            // symptom is the React UI hanging on "Waiting for text…" because the
            // backend silently received the IPC message and dropped it on the floor.
            _ = _serviceProvider.GetRequiredService<SessionManager>();
            _ = _serviceProvider.GetRequiredService<OverlayManager>();

            var shell = _serviceProvider.GetRequiredService<ShellWindow>();
            shell.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            base.OnExit(e);
            _serviceProvider.GetRequiredService<ConfigurationStorage>().SaveConfiguration();
            _serviceProvider.GetRequiredService<Translumo.HotKeys.RealTransHotKeyManager>().Dispose();
            _serviceProvider.GetRequiredService<SessionManager>().Dispose();
            _serviceProvider.GetRequiredService<OverlayManager>().Dispose();
            Log.CloseAndFlush();
        }

        private void ConfigureServices(ServiceCollection services)
        {
            services.AddLogging(b => b.AddSerilog(dispose: true));

            // Legacy pipeline configuration.
            // Defaults are applied here at DI build time and then overwritten by
            // ConfigurationStorage.LoadConfiguration() in OnStartup() — so first run
            // uses the values below and subsequent runs use whatever the user saved
            // to %APPDATA%/RealTrans/settings.
            services.AddSingleton<OcrGeneralConfiguration>(_ =>
            {
                var cfg = OcrGeneralConfiguration.Default;
                // WindowsOCR is the only engine enabled by default: it's built into
                // Windows 10+, requires no Python/CUDA/bundled models, and works
                // immediately once the user installs the source-language OCR pack.
                cfg.GetConfiguration<WindowsOCRConfiguration>().Enabled = true;
                return cfg;
            });
            services.AddSingleton<TranslationConfiguration>(_ => new TranslationConfiguration
            {
                // English source: Windows OCR ships English data by default on virtually
                // every install — no extra OCR pack required. Vietnamese target: Google
                // translator supports it (DeepL does not). The user can switch live via
                // the sidebar LanguageSwitcher (settings:set IPC), which mutates this
                // singleton; the legacy pipeline picks up the change via
                // TranslationConfiguration.PropertyChanged.
                TranslateFromLang = Languages.English,
                TranslateToLang   = Languages.Vietnamese,
                Translator        = Translators.Google,
            });
            services.AddSingleton<TtsConfiguration>(TtsConfiguration.Default);
            services.AddSingleton<ScreenCaptureConfiguration>();
            services.AddSingleton<LanguageService>();
            // Transient (NOT singleton): TranslationProcessingService is transient and
            // disposes its injected TextDetectionProvider — which in turn disposes its
            // TextValidityPredictor — on session stop (TranslationSession.Dispose →
            // processingService.Dispose). If these were singletons, the first Stop would
            // tear down app-wide instances that the next Start then reuses in a disposed
            // state. Registering them transient makes each session own its own OCR text
            // pipeline, so disposal is self-contained.
            services.AddTransient<TextValidityPredictor>();
            // Substitute the legacy TextDetectionProvider with a subclass that emits
            // raw OCR text as IPC OcrPreviewMessage on every primary-OCR call (throttled
            // 1 Hz). The legacy TranslationProcessingService injects the base type and
            // receives our subclass via virtual dispatch on GetText.
            services.AddTransient<TextDetectionProvider, PreviewingTextDetectionProvider>();
            services.AddSingleton<TextResultCacheService>();
            services.AddSingleton<TextProcessingConfiguration>(new TextProcessingConfiguration());
            services.AddSingleton<ICapturerFactory, ScreenCapturerFactory>();
            // PythonEngineWrapper's ctor touches Python.Runtime.Runtime, which loads
            // native function pointers from python38.dll. We don't ship that DLL
            // because RealTrans uses WindowsOCR + Google + None TTS — none of which
            // actually call into Python. The legacy OcrEnginesFactory / TtsFactory
            // still REQUIRE the dependency for DI to resolve them, but they only
            // dereference it inside the EasyOCR / Silero code paths we never enter.
            // GetUninitializedObject creates the wrapper without invoking its ctor,
            // satisfying the DI graph at zero runtime cost. Any code that actually
            // calls Init/Execute on this stub will NPE, which is intentional — we'd
            // rather fail loudly than have Python silently try to initialize.
            services.AddSingleton<PythonEngineWrapper>(_ =>
                (PythonEngineWrapper)System.Runtime.CompilerServices
                    .RuntimeHelpers.GetUninitializedObject(typeof(PythonEngineWrapper)));
            // TranslatorFactory's ctor takes IActionDispatcher (only the Yandex
            // translator actually uses it — Google ignores it — but DI must still
            // satisfy the parameter). The legacy InteractionActionDispatcher lives
            // in the Translumo WPF project which we don't reference, so we ship a
            // minimal local mirror in RealTrans.Core.
            services.AddSingleton<IActionDispatcher, RealTransActionDispatcher>();
            services.AddTransient<OcrEnginesFactory>();
            services.AddTransient<TranslatorFactory>();
            services.AddTransient<TtsFactory>();
            services.AddTransient<IPredictor<InputTextPrediction, OutputTextPrediction>,
                MlPredictor<InputTextPrediction, OutputTextPrediction>>();
            services.AddTransient<IEncryptionService, AesEncryptionService>();
            services.AddTransient<LanguageDescriptorFactory>();
            services.AddTransient<IProcessingService, TranslationProcessingService>();

            // ITranslationResultSink backed by WebTranslationResultSink
            services.AddSingleton<WebTranslationResultSink>();
            services.AddSingleton<ITranslationResultSink>(sp => sp.GetRequiredService<WebTranslationResultSink>());
            services.AddSingleton<IChatTextMediator>(sp => sp.GetRequiredService<WebTranslationResultSink>());

            // RealTrans.Core
            services.AddSingleton<RealTransConfiguration>(RealTransConfiguration.Default);
            services.AddSingleton<RegionPinCollection>();
            services.AddSingleton<WebMessageBus>();
            services.AddSingleton<TranslationSequencer>();
            services.AddSingleton<DpiHelper>();
            services.AddSingleton<Translumo.HotKeys.RealTransHotKeyManager>();
            services.AddSingleton<SessionManager>();

            // RealTrans.Overlay
            services.AddSingleton<OverlayManager>();
            services.AddSingleton<ICaptureIndicatorService, CaptureIndicatorService>();

            // Shell window
            services.AddSingleton<ShellWindow>();

            services.AddRealTransConfigurationStorage();
        }
    }
}

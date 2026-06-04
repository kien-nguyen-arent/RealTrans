using System;
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
                TranslateFromLang = Languages.Japanese,
                TranslateToLang   = Languages.English,
                Translator        = Translators.Google,
            });
            services.AddSingleton<TtsConfiguration>(TtsConfiguration.Default);
            services.AddSingleton<ScreenCaptureConfiguration>();
            services.AddSingleton<LanguageService>();
            services.AddSingleton<TextValidityPredictor>();
            // Substitute the legacy TextDetectionProvider with a subclass that emits
            // raw OCR text as IPC OcrPreviewMessage on every primary-OCR call (throttled
            // 1 Hz). The legacy TranslationProcessingService injects the base type and
            // receives our subclass via virtual dispatch on GetText.
            services.AddSingleton<TextDetectionProvider, PreviewingTextDetectionProvider>();
            services.AddSingleton<TextResultCacheService>();
            services.AddSingleton<TextProcessingConfiguration>(new TextProcessingConfiguration());
            services.AddSingleton<ICapturerFactory, ScreenCapturerFactory>();
            services.AddSingleton<PythonEngineWrapper>();
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

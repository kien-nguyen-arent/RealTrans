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
                .WriteTo.File("Logs/log.txt", LogEventLevel.Warning,
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

            // Legacy pipeline (unchanged)
            services.AddSingleton<OcrGeneralConfiguration>(OcrGeneralConfiguration.Default);
            services.AddSingleton<TranslationConfiguration>(TranslationConfiguration.Default);
            services.AddSingleton<TtsConfiguration>(TtsConfiguration.Default);
            services.AddSingleton<ScreenCaptureConfiguration>();
            services.AddSingleton<LanguageService>();
            services.AddSingleton<TextDetectionProvider>();
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

            // Shell window
            services.AddSingleton<ShellWindow>();

            services.AddRealTransConfigurationStorage();
        }
    }
}

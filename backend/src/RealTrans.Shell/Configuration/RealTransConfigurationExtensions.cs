using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealTrans.Core.Configuration;
using Translumo.Configuration;
using Translumo.Infrastructure.Encryption;
using Translumo.OCR.Configuration;
using Translumo.Translation.Configuration;
using Translumo.TTS;

namespace RealTrans.Shell.Configuration
{
    public static class RealTransConfigurationExtensions
    {
        public static void AddRealTransConfigurationStorage(this ServiceCollection services)
        {
            services.AddSingleton<ConfigurationStorage>(sc =>
            {
                var storage = new ConfigurationStorage(
                    sc,
                    sc.GetRequiredService<IEncryptionService>(),
                    sc.GetRequiredService<ILogger<ConfigurationStorage>>());

                storage.RegisterConfiguration<OcrGeneralConfiguration>();
                storage.RegisterConfiguration<TranslationConfiguration>();
                storage.RegisterConfiguration<TtsConfiguration>();
                storage.RegisterConfiguration<ScreenCaptureConfiguration>();
                storage.RegisterConfiguration<RealTransConfiguration>();
                storage.RegisterConfiguration<RegionPinCollection>();

                return storage;
            });
        }
    }
}

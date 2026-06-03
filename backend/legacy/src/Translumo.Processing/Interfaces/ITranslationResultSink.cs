using System;

namespace Translumo.Processing.Interfaces
{
    public interface ITranslationResultSink : IChatTextMediator
    {
        void SendRegionResult(string regionId, string sourceText, string translatedText, TimeSpan elapsed);
    }
}

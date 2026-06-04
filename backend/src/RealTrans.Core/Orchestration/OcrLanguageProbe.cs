using System.Linq;
using Translumo.Infrastructure.Language;
using Translumo.OCR.Configuration;
using Translumo.OCR.WindowsOCR;
using WinLang = Windows.Globalization.Language;
using WinOcrEngine = Windows.Media.Ocr.OcrEngine;

namespace RealTrans.Core.Orchestration
{
    public record OcrLanguageReadiness(bool Ready, string? Code, string? Message);

    /// <summary>
    /// Checks whether at least one enabled OCR engine can actually read the chosen
    /// source language. Catches the silent-no-op failure mode where
    /// <c>OcrEngine.TryCreateFromLanguage</c> returns null — without this probe,
    /// the user sees "Translation started" then nothing forever.
    /// </summary>
    public static class OcrLanguageProbe
    {
        public static OcrLanguageReadiness Check(
            OcrGeneralConfiguration ocrCfg,
            LanguageDescriptor sourceLanguage)
        {
            var enabled = ocrCfg.OcrConfigurations.Where(c => c.Enabled).ToArray();
            if (enabled.Length == 0)
            {
                return new OcrLanguageReadiness(
                    Ready: false,
                    Code: "no-ocr-engine",
                    Message: "No OCR engine is enabled. Open Settings → OCR and enable at least one engine (Windows OCR is recommended).");
            }

            // Only the Windows OCR probe is implemented — that's our recommended
            // default and the only engine enabled out of the box. Tesseract /
            // EasyOCR readiness checks can be added here when those engines are
            // enabled by default.
            if (enabled.Any(c => c is WindowsOCRConfiguration))
            {
                // OcrEngine.IsLanguageSupported is unreliable — it returns true for
                // any BCP-47 tag Windows recognizes metadata-wise, even when the OCR
                // data files for that language are NOT installed. The silent failure
                // we're trying to catch is exactly that case: TryCreateFromLanguage
                // returns null, MsEngine stays null, GetTextLines returns [] forever.
                // Mirror the WindowsOCREngine constructor's own check.
                Windows.Media.Ocr.OcrEngine? probe = null;
                try
                {
                    var winLang = new WinLang(sourceLanguage.Code);
                    probe = WinOcrEngine.TryCreateFromLanguage(winLang);
                }
                catch
                {
                    // new Language(...) throws on a malformed BCP-47 tag — treat as
                    // unsupported and surface the same install instructions.
                }

                if (probe == null)
                {
                    return new OcrLanguageReadiness(
                        Ready: false,
                        Code: "ocr-language-unavailable",
                        Message: $"{sourceLanguage.Language} OCR is not installed. Open Windows Settings → Time & Language → Language & region → Add a language → {sourceLanguage.Language} → Optional language features → Enable \"Optical character recognition\", then restart RealTrans.");
                }
            }

            return new OcrLanguageReadiness(Ready: true, Code: null, Message: null);
        }
    }
}

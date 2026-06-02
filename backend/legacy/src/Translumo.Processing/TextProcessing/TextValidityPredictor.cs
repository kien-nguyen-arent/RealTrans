using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Translumo.Infrastructure.Constants;
using Translumo.Infrastructure.Language;
using Translumo.Infrastructure.MachineLearning;
using Translumo.Utils;

namespace Translumo.Processing.TextProcessing
{
    public class TextValidityPredictor : IDisposable
    {
        public Languages Language
        {
            get => _language;
            set
            {
                _language = value;
                Init();
            }
        }

        private Languages _language;
        private LanguageDescriptor _languageDescriptor;
        private Regex _langAlphabetRegex;
        private TextTokenizer _textTokenizer;
        private bool _modelMissing;

        // Score returned when the ML predictor model is missing. Must exceed the
        // MIN_SCORE_THRESHOLD (2.1f) gate in TranslationProcessingService so that
        // OCR results still flow through to translation when running without the
        // optional 400 MB component bundle.
        private const float NO_MODEL_FALLBACK_SCORE = 5.0f;

        private readonly IPredictor<InputTextPrediction, OutputTextPrediction> _validityPredictor;
        private readonly LanguageService _languageService;
        private readonly string _predictionModelsPath = Path.Combine(Global.ModelsPath, "Prediction");
        private readonly ILogger _logger;
        private readonly ManualResetEvent _sync = new ManualResetEvent(false);

        private IReadOnlyDictionary<string, string> _replacers = new Dictionary<string, string>()
        {
            { "，", "," },
            { " 、", "," },
            { "！", "!" },
            { "？", "?" },
            { "；", ";" },
            { "：", ":" },
            { "（", "(" },
            { "）", ")" },
            { "［", "[" },
            { "］", "]" },
            { "【", "[" },
            { "】", "]" },
            { "、", "," },
            { "…", "..." },
            { "⸺", "-" },
            { "．", ". " },
            { "♪", "" },
            { "〟", "\"" },
            { "〝", "\"" },
            { "”", "\"" },
            { "“", "\"" },
            { "・・・", "..." },
            { "‥", ".." },
            { "`", "'" },
            { "—", "-" },
            { "′", "'" },

            { "０", "0" },
            { "１", "1" },
            { "２", "2" },
            { "３", "3" },
            { "４", "4" },
            { "５", "5" },
            { "６", "6" },
            { "７", "7" },
            { "８", "8" },
            { "９", "9" },
        };

        public TextValidityPredictor(IPredictor<InputTextPrediction, OutputTextPrediction> validityPredictor, LanguageService languageService, 
            ILogger<TextValidityPredictor> logger)
        {
            this._validityPredictor = validityPredictor;
            this._languageService = languageService;
            this._logger = logger;
        }
        
        public float Predict(string[] textLines, out string validatedText)
        {
            const int PREDICT_ATTEMPTS = 3;
            validatedText = string.Join(' ', textLines);
            if (string.IsNullOrWhiteSpace(validatedText) || !_langAlphabetRegex.IsMatch(validatedText))
            {
                return 0.0f;
            }

            validatedText = PreProcessText(textLines);
            if (_textTokenizer != null)
            {
                validatedText = _textTokenizer.Tokenize(validatedText);
            }

            // No ML model available → treat any text that already passed the alphabet
            // regex above as valid with a high constant score so downstream gates pass.
            if (_modelMissing)
            {
                return NO_MODEL_FALLBACK_SCORE;
            }

            var curAttempt = 0;
            if (!_validityPredictor.Loaded)
            {
                _sync.WaitOne(6000);
            }

            while (true)
            {
                curAttempt++;
                try
                {
                    return _validityPredictor.PredictResult(new InputTextPrediction() { Text = validatedText }).Validity;
                }
                catch (Exception)
                {
                    if (curAttempt >= PREDICT_ATTEMPTS)
                    {
                        return default(float);
                    }
                }
            }
        }

        private void Init()
        {
            _sync.Reset();
            _logger.LogTrace($"Initialization prediction model (lang: {Language})");
            _languageDescriptor = _languageService.GetLanguageDescriptor(Language);
            var modelPath = Path.Combine(_predictionModelsPath, _languageDescriptor.TextScorePredictorModel);

            // Make ML scoring optional: app should run even without the 400 MB
            // components.zip bundle. When the model is absent, fall back to a
            // constant score in Predict() so the rest of the pipeline still flows.
            if (!File.Exists(modelPath))
            {
                _logger.LogWarning(
                    "Prediction model '{Path}' not found — running without ML scoring. " +
                    "OCR results will not be ranked by confidence.", modelPath);
                _modelMissing = true;
            }
            else
            {
                _modelMissing = false;
                try
                {
                    _validityPredictor.LoadModel(modelPath);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Predictor model loading error — falling back to no-ML mode");
                    _modelMissing = true;
                }
            }

            _sync.Set();
            _langAlphabetRegex = BuildAlphabetRegex(_languageDescriptor.SupportedNamedBlocks);
            _textTokenizer = _languageDescriptor.UseWordTokenizer ? new TextTokenizer(_languageDescriptor.Code) : null;
        }

        private string PreProcessText(IEnumerable<string> textLines)
        {
            var result = new StringBuilder();
            foreach (var textLine in textLines)
            {
                var lineRes = NormalizeString(textLine);
                lineRes = lineRes.Trim('-', ' ');
                if (lineRes.Length > 1 && lineRes[0] == lineRes[^1] && (lineRes[0] == '\'' || lineRes[0] == '"'))
                {
                    lineRes = lineRes[1..^1];
                }

                lineRes = RegexStorage.EndDotRegex.Replace(RegexStorage.StartDotRegex.Replace(lineRes, string.Empty),
                    string.Empty);

                if (!string.IsNullOrWhiteSpace(lineRes))
                {
                    result.Append((result.Length > 0 ? " " : string.Empty) + lineRes);
                }
            }

            var resultStr = result.ToString().Trim();
            if (_languageDescriptor.UseEndPunctuation && resultStr.Length > 0 && !resultStr[^1].IsSeparator())
            {
                resultStr += ".";
            }

            return RegexStorage.MultipleSpacesRegex.Replace(resultStr, " ");
        }

        private string NormalizeString(string str)
        {
            var strBuilder = new StringBuilder(str.Length);
            for (var i = 0; i < str.Length; i++)
            {
                if (_replacers.ContainsKey(str[i].ToString()))
                {
                    strBuilder.Append(_replacers[str[i].ToString()]);
                }
                else
                {
                    strBuilder.Append(str[i]);
                }
            }

            return strBuilder.ToString();
        }

        private Regex BuildAlphabetRegex(string[] supportedNamedBlocks)
        {
            var supportedBlocks = string.Join('|', supportedNamedBlocks.Select(block => $@"(\p{{{block}}})"));

            return new Regex($@"(?={supportedBlocks})(?=[^\d\W])", RegexOptions.Compiled);
        }

        public void Dispose()
        {
            _validityPredictor?.Dispose();
        }
    }
}

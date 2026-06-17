using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage.Streams;
using Translumo.Infrastructure.Language;

namespace Translumo.OCR.WindowsOCR
{
    public class WindowsOCREngine : IOCREngine, IOcrTextBoundsProvider
    {
        public Languages DetectionLanguage => LanguageDescriptor.Language;
        public virtual int Confidence => 5;
        public virtual byte PrimaryPriority => 10;
        public bool SecondaryPrimaryCheck => true;

        // Bounding box (source-image pixel space) of all text from the most recent
        // GetTextLines call, or null when none was found. The caller
        // (TextDetectionProvider) snapshots this immediately after GetTextLines so a
        // later call on this reused engine instance can't clobber an in-flight result.
        private Rectangle? _lastTextBounds;
        public Rectangle? LastTextBounds => _lastTextBounds;

        protected readonly OcrEngine MsEngine;
        protected readonly LanguageDescriptor LanguageDescriptor;

        protected ImageFormat ImgFormat;

        public WindowsOCREngine(LanguageDescriptor languageDescriptor)
        {
            LanguageDescriptor = languageDescriptor;
            MsEngine = OcrEngine.TryCreateFromLanguage(new Language(LanguageDescriptor.Code));
            ImgFormat = ImageFormat.Tiff;
        }

        public string[] GetTextLines(byte[] image)
        {
            if (MsEngine == null)
            {
                _lastTextBounds = null;
                return [];
            }

            using var stream = new MemoryStream(image);
            // Hold the decoded source so we know its pixel size: OCR bounding boxes
            // come back in the (possibly pre-processed) image's coordinate space and
            // are mapped back to the source below.
            using var srcBitmap = new Bitmap(stream);
            int srcW = srcBitmap.Width, srcH = srcBitmap.Height;
            Bitmap bitmap = PreProcess(srcBitmap);

            SoftwareBitmap softwareBitmap;
            using (var randStream = new InMemoryRandomAccessStream())
            {
                bitmap.Save(randStream.AsStream(), ImgFormat);
                var decoder = BitmapDecoder.CreateAsync(randStream).AsTask().Result;
                softwareBitmap = decoder.GetSoftwareBitmapAsync().AsTask().Result;
            }

            OcrResult result = MsEngine.RecognizeAsync(softwareBitmap).AsTask().Result;

            _lastTextBounds = ComputeTextBounds(result, srcW, srcH, bitmap.Width, bitmap.Height);

            return result.Lines
                .Select(line => LanguageDescriptor.UseSpaceRemover ? line.Text.Replace(" ", string.Empty) : line.Text)
                .ToArray();
        }

        // Union of every recognized word's bounding box, mapped from the OCR image's
        // pixel space back to the source screenshot's pixel space. Null when there
        // are no usable word boxes.
        private static Rectangle? ComputeTextBounds(OcrResult result, int srcW, int srcH, int ocrW, int ocrH)
        {
            double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
            bool any = false;
            foreach (var line in result.Lines)
            {
                foreach (var word in line.Words)
                {
                    var r = word.BoundingRect;
                    if (r.Width <= 0 || r.Height <= 0) continue;
                    any = true;
                    if (r.X < minX) minX = r.X;
                    if (r.Y < minY) minY = r.Y;
                    if (r.X + r.Width > maxX) maxX = r.X + r.Width;
                    if (r.Y + r.Height > maxY) maxY = r.Y + r.Height;
                }
            }
            return any ? MapBoundsToSource(minX, minY, maxX, maxY, srcW, srcH, ocrW, ocrH) : null;
        }

        // Scales a bounding box from OCR-image pixels to source-image pixels and
        // clamps it to the source. PreProcess does not currently resize, so the
        // scale is 1; the division is kept so a future resizing PreProcess stays
        // correct.
        private static Rectangle? MapBoundsToSource(
            double minX, double minY, double maxX, double maxY, int srcW, int srcH, int ocrW, int ocrH)
        {
            if (maxX <= minX || maxY <= minY || srcW <= 0 || srcH <= 0) return null;

            double sx = ocrW > 0 ? (double)srcW / ocrW : 1.0;
            double sy = ocrH > 0 ? (double)srcH / ocrH : 1.0;

            int x = (int)Math.Floor(minX * sx);
            int y = (int)Math.Floor(minY * sy);
            int w = (int)Math.Ceiling((maxX - minX) * sx);
            int h = (int)Math.Ceiling((maxY - minY) * sy);

            if (x < 0) { w += x; x = 0; }
            if (y < 0) { h += y; y = 0; }
            if (x + w > srcW) w = srcW - x;
            if (y + h > srcH) h = srcH - y;
            if (w <= 0 || h <= 0) return null;

            return new Rectangle(x, y, w, h);
        }

        protected virtual Bitmap PreProcess(Bitmap bitmap)
        {
            return bitmap;
        }
    }
}

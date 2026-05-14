using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Windows.Media.Imaging;

namespace Translumo.Utils
{
    internal static class BitmapExtensions
    {
        public static byte[] ToBytes(this Bitmap bitmap, ImageFormat imgFormat)
        {
            using var ms = new MemoryStream();
            bitmap.Save(ms, imgFormat);
            return ms.ToArray();
        }

        public static BitmapImage ToBitmapImage(this Bitmap bitmap)
        {
            using var memory = new MemoryStream();
            bitmap.Save(memory, ImageFormat.Png);
            memory.Position = 0;
            var bitmapImage = new BitmapImage();
            bitmapImage.BeginInit();
            bitmapImage.StreamSource = memory;
            bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
            bitmapImage.EndInit();
            bitmapImage.Freeze();
            return bitmapImage;
        }
    }
}

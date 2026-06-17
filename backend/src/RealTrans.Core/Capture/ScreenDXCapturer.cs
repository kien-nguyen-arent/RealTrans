using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Threading;
using SharpDX;
using SharpDX.Direct3D11;
using SharpDX.DXGI;
using Translumo.Configuration;
using Translumo.Processing.Exceptions;
using Translumo.Processing.Interfaces;
using Translumo.Utils;

namespace Translumo.Services
{
    public class ScreenDXCapturer : IScreenCapturer
    {
        public int CaptureAttempts { get; set; } = 5;
        public int AttemptDelayMs { get; set; } = 250;

        private Factory1 _factory;
        private Adapter1 _adapter;
        private SharpDX.Direct3D11.Device _device;
        private Output _output;
        private Output1 _output1;
        private Texture2DDescription _textureDesc;
        private Texture2D _screenTexture;
        private OutputDuplication _duplicatedOutput;

        private int _width;
        private int _height;
        private bool _initalized = false;

        private readonly ScreenCaptureConfiguration _configuration;

        public ScreenDXCapturer(ScreenCaptureConfiguration configuration)
        {
            _configuration = configuration;
        }

        public void Initialize()
        {
            if (_initalized) Dispose();

            _factory = new Factory1();
            _adapter = _factory.GetAdapter1(0);
            _device = new SharpDX.Direct3D11.Device(_adapter);
            _output = _adapter.GetOutput(0);
            _output1 = _output.QueryInterface<Output1>();

            _width = _output.Description.DesktopBounds.Right;
            _height = _output.Description.DesktopBounds.Bottom;

            _textureDesc = new Texture2DDescription
            {
                CpuAccessFlags = CpuAccessFlags.Read,
                BindFlags = BindFlags.None,
                Format = Format.B8G8R8A8_UNorm,
                Width = _width,
                Height = _height,
                OptionFlags = ResourceOptionFlags.None,
                MipLevels = 1,
                ArraySize = 1,
                SampleDescription = { Count = 1, Quality = 0 },
                Usage = ResourceUsage.Staging
            };
            _screenTexture = new Texture2D(_device, _textureDesc);
            _duplicatedOutput = _output1.DuplicateOutput(_device);
            _initalized = true;
        }

        public byte[] CaptureScreen()
        {
            if (_configuration.CaptureArea.IsEmpty)
                throw new CaptureException("Capture area is not selected");
            try { return MakeScreenshotInternal(_configuration.CaptureArea, 1); }
            catch (CaptureException) { throw; }
            catch (Exception ex) { throw new CaptureException("Failed to capture screen", ex); }
        }

        public byte[] CaptureScreen(RectangleF captureArea)
        {
            try { return MakeScreenshotInternal(captureArea, 1); }
            catch (CaptureException) { throw; }
            catch (Exception ex) { throw new CaptureException("Failed to capture screen", ex); }
        }

        public void Dispose()
        {
            _duplicatedOutput?.Dispose(); _duplicatedOutput = null;
            _device?.Dispose(); _device = null;
            _screenTexture?.Dispose(); _screenTexture = null;
            _adapter?.Dispose(); _adapter = null;
            _output?.Dispose(); _output = null;
            _output1?.Dispose(); _output1 = null;
            _initalized = false;
        }

        private byte[] MakeScreenshotInternal(RectangleF captureArea, int curAttempt)
        {
            SharpDX.DXGI.Resource screenResource = null;
            // CRITICAL: capture the duplicated-output reference into a local before
            // the first use. Dispose() runs on the UI thread (called from
            // TranslationSession.Dispose during session restart) and nulls
            // _duplicatedOutput / _device while the capture loop on a background
            // thread is mid-call. Without this snapshot, the access on the next
            // line throws NullReferenceException instead of a clean CaptureException
            // the retry/abort logic can handle. Same reasoning for _device below.
            var duplicatedOutput = _duplicatedOutput;
            var device = _device;
            if (duplicatedOutput == null || device == null || !_initalized)
                throw new CaptureException("Capturer disposed during frame acquisition");
            try
            {
                var resultAcquire = duplicatedOutput.TryAcquireNextFrame(100, out _, out screenResource);
                if (!resultAcquire.Success)
                    throw new CaptureException("Failed to acquire frame", resultAcquire.Code);

                using (var screenTexture2D = screenResource.QueryInterface<Texture2D>())
                    device.ImmediateContext.CopyResource(screenTexture2D, _screenTexture);

                var mapSource = device.ImmediateContext.MapSubresource(_screenTexture, 0, MapMode.Read, SharpDX.Direct3D11.MapFlags.None);

                using (var bitmap = new Bitmap(_width, _height, PixelFormat.Format32bppArgb))
                {
                    var mapDest = bitmap.LockBits(new Rectangle(0, 0, _width, _height), ImageLockMode.WriteOnly, bitmap.PixelFormat);
                    var sourcePtr = mapSource.DataPointer;
                    var destPtr = mapDest.Scan0;
                    for (int y = 0; y < _height; y++)
                    {
                        Utilities.CopyMemory(destPtr, sourcePtr, _width * 4);
                        sourcePtr = IntPtr.Add(sourcePtr, mapSource.RowPitch);
                        destPtr = IntPtr.Add(destPtr, mapDest.Stride);
                    }
                    bitmap.UnlockBits(mapDest);
                    device.ImmediateContext.UnmapSubresource(_screenTexture, 0);
                    return bitmap.Clone(captureArea, bitmap.PixelFormat).ToBytes(ImageFormat.Tiff);
                }
            }
            catch (CaptureException) when (curAttempt >= CaptureAttempts || !_initalized) { throw; }
            catch (Exception) when (curAttempt >= CaptureAttempts || !_initalized) { throw; }
            catch (Exception)
            {
                Thread.Sleep(AttemptDelayMs);
                return MakeScreenshotInternal(captureArea, ++curAttempt);
            }
            finally
            {
                // Same null-snapshot pattern in finally — Dispose could have run
                // between the try-entry snapshot and here, in which case the
                // ReleaseFrame call would NRE on a stale field. Use the local.
                try
                {
                    screenResource?.Dispose();
                    duplicatedOutput?.ReleaseFrame();
                }
                catch { }
            }
        }
    }
}

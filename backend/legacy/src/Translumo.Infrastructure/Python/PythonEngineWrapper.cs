using System;
using System.IO;
using Python.Runtime;
using Translumo.Infrastructure.Constants;

namespace Translumo.Infrastructure.Python;

/// <summary>
/// Reconstructed from the upstream ramjke/Translumo project so the legacy OCR/TTS
/// pipeline (EasyOCR, Silero) can compile and resolve via DI. Runtime use still
/// requires an embedded CPython 3.8 distribution at <see cref="Global.PythonPath"/>;
/// pure C# OCR engines (Windows OCR, Tesseract) and Windows TTS do not need it.
/// </summary>
public class PythonEngineWrapper : IDisposable
{
    private bool _disposedValue;
    private int _countUsage;
    private IntPtr _threadState;

    public PythonEngineWrapper()
    {
        Runtime.PythonDLL = Path.Combine(Global.PythonPath, "python38.dll");
        PythonEngine.PythonHome = Global.PythonPath;
    }

    public PyObject Import(string libName) => Py.Import(libName);

    public void Execute(Action action)
    {
        Execute<object>(() => { action(); return null; });
    }

    public T Execute<T>(Func<T> func)
    {
        using (Py.GIL())
        {
            return func();
        }
    }

    public void Init()
    {
        if (_countUsage++ > 0)
        {
            return;
        }

        InitInternal();
    }

    private void InitInternal()
    {
        _disposedValue = false;

        if (!PythonEngine.IsInitialized)
        {
            // TODO: move to common place, also used in EasyOCR
            Runtime.PythonDLL = Path.Combine(Global.PythonPath, "python38.dll");
            PythonEngine.Initialize();
            PythonEngine.BeginAllowThreads();
        }
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposedValue)
        {
            if (disposing)
            {
                // TODO: dispose managed state (managed objects)
            }

            if (PythonEngine.IsInitialized)
            {
                // Causes PythonEngine.Shutdown() hanging (https://github.com/pythonnet/pythonnet/issues/1701)
                // PythonEngine.EndAllowThreads(_threadState);
                PythonEngine.Shutdown();
            }

            _disposedValue = true;
        }
    }

    ~PythonEngineWrapper()
    {
        Dispose(disposing: false);
    }

    public void Dispose()
    {
        if (--_countUsage > 0)
        {
            return;
        }

        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }
}

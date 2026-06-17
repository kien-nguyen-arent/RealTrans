using RealTrans.Core.Bridge;

namespace RealTrans.Core.Orchestration
{
    /// <summary>
    /// Shows / hides a persistent on-screen marker for the region the OCR loop is
    /// polling. Implementation lives in RealTrans.Overlay (where WPF window code
    /// belongs) but the interface is in Core so SessionManager — which lives in
    /// Core and shouldn't reference Overlay — can call it via DI.
    /// </summary>
    public interface ICaptureIndicatorService
    {
        void Show(string regionId, RectDto rect);
        void Hide(string regionId);
    }
}

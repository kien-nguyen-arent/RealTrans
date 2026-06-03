namespace RealTrans.Core.Stabilization
{
    /// <summary>
    /// Requires the same OCR text across N consecutive frames before triggering translation.
    /// Prevents translation spam on unstable/animated subtitle rendering.
    /// </summary>
    public class StabilizationEngine
    {
        private readonly int _requiredConsecutiveFrames;
        private string _lastText = string.Empty;
        private int _consecutiveCount;

        public StabilizationEngine(int requiredConsecutiveFrames = 2)
        {
            _requiredConsecutiveFrames = requiredConsecutiveFrames;
        }

        public bool IsStable(string text)
        {
            if (text == _lastText)
            {
                _consecutiveCount++;
            }
            else
            {
                _lastText = text;
                _consecutiveCount = 1;
            }

            return _consecutiveCount >= _requiredConsecutiveFrames;
        }

        public void Reset()
        {
            _lastText = string.Empty;
            _consecutiveCount = 0;
        }
    }
}

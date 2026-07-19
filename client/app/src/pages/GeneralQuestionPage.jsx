// src/pages/GeneralQuestionPage.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

// ---------- Embedded Network Test Component (theme‑aware) ----------
function NetworkTestInline({ onComplete, isWhiteTheme }) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
  const DEFAULT_SAMPLE_COUNT = 5;
  const DEFAULT_DELAY_MS = 100;
  const CACHE_TTL_MS = 30000;

  const [status, setStatus] = useState('idle');
  const [average, setAverage] = useState(null);
  const [stats, setStats] = useState({ min: null, max: null, samples: 0 });
  const [individualResults, setIndividualResults] = useState([]);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const cacheRef = useRef(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const runTest = useCallback(async (force = false) => {
    if (!force && cacheRef.current && (Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS)) {
      if (mountedRef.current) {
        const cached = cacheRef.current;
        setAverage(cached.result);
        setStats(cached.stats);
        setIndividualResults(cached.individual);
        setStatus('done');
        setError(null);
        onComplete?.(true);
      }
      return;
    }

    if (mountedRef.current) {
      setStatus('running');
      setError(null);
      setIndividualResults([]);
      setProgress(0);
      setAverage(null);
      setStats({ min: null, max: null, samples: 0 });
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const results = [];
    for (let i = 0; i < DEFAULT_SAMPLE_COUNT; i++) {
      if (signal.aborted || !mountedRef.current) break;
      const start = performance.now();
      try {
        const response = await fetch(`${API_BASE}/api/latency-test`, {
          credentials: 'include',
          signal,
        });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        await response.json();
        results.push(performance.now() - start);
      } catch (err) {
        if (err.name === 'AbortError' || !mountedRef.current) break;
      }
      if (mountedRef.current) {
        setProgress(((i + 1) / DEFAULT_SAMPLE_COUNT) * 100);
      }
      if (i < DEFAULT_SAMPLE_COUNT - 1 && !signal.aborted && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, DEFAULT_DELAY_MS));
      }
    }

    abortControllerRef.current = null;
    if (!mountedRef.current) return;

    if (signal.aborted) {
      setStatus('idle');
      setProgress(0);
      return;
    }

    if (results.length === 0) {
      setStatus('error');
      setError('All attempts failed. Please check your network or try again.');
      setProgress(100);
      onComplete?.(false);
      return;
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const avgRounded = Math.round(avg);
    const min = Math.min(...results);
    const max = Math.max(...results);

    setAverage(avgRounded);
    setStats({ min, max, samples: results.length });
    setIndividualResults(results);
    setStatus('done');
    setProgress(100);

    cacheRef.current = {
      result: avgRounded,
      stats: { min, max, samples: results.length },
      individual: results,
      timestamp: Date.now(),
    };

    onComplete?.(true);
  }, [onComplete]);

  const clearCache = useCallback(() => {
    cacheRef.current = null;
    if (mountedRef.current) {
      setStatus('idle');
      setAverage(null);
      setStats({ min: null, max: null, samples: 0 });
      setIndividualResults([]);
      setError(null);
      setProgress(0);
    }
  }, []);

  const theme = {
    card: isWhiteTheme ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800',
    text: isWhiteTheme ? 'text-gray-800' : 'text-zinc-300',
    muted: isWhiteTheme ? 'text-gray-500' : 'text-zinc-400',
    resultBg: isWhiteTheme ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800 border-zinc-700',
    progressBg: isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-700',
    errorBg: isWhiteTheme
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-red-500/10 border-red-500/20 text-red-400',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
    buttonSecondary: isWhiteTheme
      ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700',
    individualPing: isWhiteTheme
      ? 'bg-gray-100 border-gray-300 text-gray-700'
      : 'bg-zinc-900 border-zinc-700 text-zinc-400',
  };

  const renderStatusMessage = () => {
    if (status === 'idle') return 'Press "Run Test" to measure your network latency.';
    if (status === 'running') return `Measuring... (${Math.round(progress)}%)`;
    if (status === 'done') return '✅ Test completed';
    if (status === 'error') return `❌ ${error || 'An error occurred'}`;
    return '';
  };

  return (
    <div className={`mt-6 p-4 rounded-lg border ${theme.card}`}>
      <h3 className={`text-sm font-semibold ${theme.text} mb-3`}>🌐 Network Latency Test</h3>
      <p className={`text-xs ${theme.muted} mb-3`}>
        Measures your round‑trip time to the server via 5 ping‑pong requests.
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => runTest(false)}
          disabled={status === 'running'}
          className={`px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50 ${theme.buttonPrimary}`}
        >
          {status === 'running' ? '⏳ Measuring...' : '▶ Run Test'}
        </button>
        {cacheRef.current && (
          <button
            onClick={clearCache}
            className={`px-4 py-2 rounded text-sm transition ${theme.buttonSecondary}`}
          >
            🗑️ Clear Cache
          </button>
        )}
      </div>

      {status === 'running' && (
        <div className={`mt-3 w-full rounded-full h-2 ${theme.progressBg}`}>
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className={`mt-3 text-sm ${theme.text}`}>{renderStatusMessage()}</div>

      {status === 'done' && average !== null && (
        <div className={`mt-3 rounded p-4 text-center border ${theme.resultBg}`}>
          <div className={`text-3xl font-bold ${isWhiteTheme ? 'text-emerald-600' : 'text-emerald-400'}`}>
            {average} ms
          </div>
          <div className={`text-xs ${theme.muted} mt-1`}>average round‑trip</div>
          {stats.samples > 0 && (
            <div className="flex justify-center gap-4 mt-2 text-xs text-zinc-500">
              <span>Min: {Math.round(stats.min)} ms</span>
              <span>Max: {Math.round(stats.max)} ms</span>
              <span>Samples: {stats.samples}</span>
            </div>
          )}
          {individualResults.length > 0 && (
            <div className="mt-3">
              <p className={`text-xs mb-1 ${theme.muted}`}>Individual ping times (ms):</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {individualResults.map((time, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 border rounded text-xs ${theme.individualPing}`}
                  >
                    {Math.round(time)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className={`mt-3 rounded p-3 text-xs ${theme.errorBg}`}>
          {error}
          <button onClick={() => runTest(true)} className="block mt-1 text-blue-400 hover:underline">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Main General Question Page ----------
const GeneralQuestionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  const username = location.state?.username || '';
  const email = location.state?.email || '';

  // Form state
  const [useCase, setUseCase] = useState('');
  const [heardFrom, setHeardFrom] = useState('');
  const [excitedFeatures, setExcitedFeatures] = useState([]);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isTestComplete, setIsTestComplete] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTestComplete = useCallback((success) => {
    setIsTestComplete(success === true);
  }, []);

  const toggleFeature = useCallback((feature) => {
    setExcitedFeatures(prev =>
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  }, []);

  const featureOptions = [
    'API Mocking', 'Latency Simulation', 'AI‑Powered Design', 'Real‑Time Analytics', 'Team Collaboration'
  ];

  const isFormValid = useMemo(
    () =>
      useCase.trim() !== '' &&
      heardFrom.trim() !== '' &&
      excitedFeatures.length > 0 &&
      isTestComplete &&
      termsAccepted,
    [useCase, heardFrom, excitedFeatures, isTestComplete, termsAccepted]
  );

  const handleContinue = useCallback(() => {
    if (!isFormValid) return;
    setIsSubmitting(true);

    // TODO: Replace with actual API call to save survey answers
    console.log('Survey answers:', { useCase, heardFrom, excitedFeatures, additionalFeedback, username, email });

    setTimeout(() => {
      navigate('/', { replace: true, state: { from: 'onboarding' } });
    }, 500);
  }, [useCase, heardFrom, excitedFeatures, additionalFeedback, username, email, navigate, isFormValid]);

  // ─── Theme classes ──────────────────────────────────────────
  const themeClasses = {
    page: isWhiteTheme ? 'bg-white text-gray-800' : 'bg-zinc-950 text-zinc-300',
    header: isWhiteTheme ? 'bg-white border-gray-200' : 'bg-zinc-950 border-zinc-800',
    label: isWhiteTheme ? 'text-gray-700' : 'text-zinc-300',
    input: isWhiteTheme
      ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'
      : 'bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder-zinc-500',
    inputFocus: 'focus:border-blue-500',
    description: isWhiteTheme ? 'text-gray-600' : 'text-zinc-400',
    buttonEnabled: 'bg-blue-600 hover:bg-blue-500 text-white',
    buttonDisabled: isWhiteTheme
      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
      : 'bg-zinc-700 text-zinc-300 cursor-not-allowed',
  };

  const inputBase = `w-full rounded px-3 py-2 text-sm outline-none transition-colors ${themeClasses.input} ${themeClasses.inputFocus}`;
  const labelBase = `block text-xs font-medium mb-1 ${themeClasses.label}`;

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-150 ${themeClasses.page}`}>
      {/* Header */}
      <div className={`h-12 flex items-center px-6 border-b shrink-0 ${themeClasses.header}`}>
        <h1 className="flex-1 text-center text-sm font-semibold tracking-wide select-none text-white">
          🚀 Welcome, {username || 'Guest'}!
        </h1>
        <div className="w-20" />
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        <p className={`text-sm ${themeClasses.description}`}>
          Let’s personalise your experience. Please answer a few questions and run the network test.
        </p>

        {/* General Questions */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">General Questions</h2>

          {/* Use Case */}
          <div>
            <label className={labelBase}>
              What is your primary use case for MockAPI? <span className="text-red-400">*</span>
            </label>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className={inputBase}
            >
              <option value="">Select an option</option>
              <option value="prototyping">Prototyping</option>
              <option value="testing">Testing / QA</option>
              <option value="demo">Demonstration</option>
              <option value="learning">Learning / Experimentation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* How did you hear? */}
          <div>
            <label className={labelBase}>
              How did you hear about us? <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              placeholder="e.g., Google, Twitter, friend..."
              className={inputBase}
            />
          </div>

          {/* Excited Features (multi-select) */}
          <div>
            <label className={labelBase}>
              What features are you most excited about? <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((feature) => (
                <label key={feature} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excitedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="accent-blue-500 w-3.5 h-3.5"
                  />
                  {feature}
                </label>
              ))}
            </div>
            {excitedFeatures.length > 0 && (
              <div className="mt-1 text-xs text-zinc-500">
                Selected: {excitedFeatures.join(', ')}
              </div>
            )}
          </div>

          {/* Additional Feedback */}
          <div>
            <label className={labelBase}>Additional feedback (optional)</label>
            <textarea
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              rows="2"
              placeholder="Anything else you'd like to share?"
              className={inputBase}
            />
          </div>
        </div>

        {/* Embedded Network Test */}
        <NetworkTestInline onComplete={handleTestComplete} isWhiteTheme={isWhiteTheme} />

        {/* Terms & Conditions + Continue button */}
        <div className="flex flex-wrap items-center justify-between pt-4 border-t border-zinc-800 gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="termsCheckbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="accent-blue-500 w-4 h-4"
            />
            <label htmlFor="termsCheckbox" className="text-xs text-zinc-500">
              I agree to the{' '}
              <a href="/terms" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Terms & Conditions
              </a>
            </label>
          </div>
          <button
            onClick={handleContinue}
            disabled={!isFormValid || isSubmitting}
            className={`px-6 py-2 rounded text-sm font-semibold transition flex items-center gap-2 ${
              isFormValid && !isSubmitting ? themeClasses.buttonEnabled : themeClasses.buttonDisabled
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Please wait...
              </>
            ) : (
              'Continue →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralQuestionPage;
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const runTest = useCallback(async (force = false) => {
    if (!force && cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS) {
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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        await response.json().catch(() => ({}));
        results.push(performance.now() - start);
      } catch (err) {
        if (err.name === 'AbortError' || !mountedRef.current) break;
      }
      if (mountedRef.current) {
        setProgress(((i + 1) / DEFAULT_SAMPLE_COUNT) * 100);
      }
      if (i < DEFAULT_SAMPLE_COUNT - 1 && !signal.aborted && mountedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_DELAY_MS));
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
      setError('All attempts failed. Please check your network connection and try again.');
      setProgress(100);
      onComplete?.(false);
      return;
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const avgRounded = Math.round(avg);
    const min = Math.min(...results);
    const max = Math.max(...results);

    setAverage(avgRounded);
    setStats({
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
      samples: results.length,
    });
    setIndividualResults(results);
    setStatus('done');
    setProgress(100);

    cacheRef.current = {
      result: avgRounded,
      stats: {
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : 0,
        samples: results.length,
      },
      individual: results,
      timestamp: Date.now(),
    };

    onComplete?.(true);
  }, [onComplete]);

  const clearCache = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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

  // ── Theme-aware styles ──
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const textPrimary = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const textMuted = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const resultBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-800";
  const progressBg = isWhiteTheme ? "bg-gray-200" : "bg-zinc-700";
  const errorBg = isWhiteTheme
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-red-500/10 border-red-500/20 text-red-400";
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";
  const buttonSecondary = isWhiteTheme
    ? "bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300"
    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700";
  const individualPing = isWhiteTheme
    ? "bg-gray-100 border-gray-300 text-gray-700"
    : "bg-zinc-900 border-zinc-700 text-zinc-400";

  const renderStatusMessage = () => {
    if (status === 'idle') return 'Press "Run Test" to measure your network latency.';
    if (status === 'running') return `Measuring... (${Math.round(progress)}%)`;
    if (status === 'done') return '✅ Test completed';
    if (status === 'error') return `❌ ${error || 'An error occurred'}`;
    return '';
  };

  return (
    <div className={`mt-6 p-5 rounded-xl border ${cardBg} ${borderColor} transition-colors duration-200`}>
      <h3 className={`text-sm font-semibold ${textPrimary} mb-1`}>🌐 Network Latency Test</h3>
      <p className={`text-xs ${textMuted} mb-3`}>
        Measures your round‑trip time to the server via 5 ping‑pong requests.
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => runTest(false)}
          disabled={status === 'running'}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'
          }`}
        >
          {status === 'running' ? '⏳ Measuring...' : '▶ Run Test'}
        </button>
        {cacheRef.current && (
          <button
            type="button"
            onClick={clearCache}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${buttonSecondary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'
            }`}
          >
            🗑️ Clear Cache
          </button>
        )}
      </div>

      {status === 'running' && (
        <div className={`mt-3 w-full rounded-full h-2 ${progressBg}`}>
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className={`mt-3 text-sm ${textPrimary}`}>{renderStatusMessage()}</div>

      {status === 'done' && average !== null && (
        <div className={`mt-3 rounded-xl p-4 text-center border ${resultBg} ${borderColor}`}>
          <div className={`text-3xl font-bold font-mono ${isWhiteTheme ? 'text-emerald-600' : 'text-emerald-400'}`}>
            {average} ms
          </div>
          <div className={`text-xs ${textMuted} mt-1`}>average round‑trip</div>
          {stats.samples > 0 && (
            <div className="flex justify-center gap-4 mt-2 text-xs text-zinc-500 font-mono">
              <span>Min: {Math.round(stats.min)} ms</span>
              <span>Max: {Math.round(stats.max)} ms</span>
              <span>Samples: {stats.samples}</span>
            </div>
          )}
          {individualResults.length > 0 && (
            <div className="mt-3">
              <p className={`text-xs mb-1.5 ${textMuted}`}>Individual ping times (ms):</p>
              <div className="flex flex-wrap justify-center gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                {individualResults.map((time, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 border rounded text-xs font-mono ${individualPing}`}
                  >
                    {Math.round(time)} ms
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className={`mt-3 rounded-lg p-3 text-xs border ${errorBg}`}>
          {error}
          <button
            type="button"
            onClick={() => runTest(true)}
            className="block mt-1 text-blue-400 hover:underline focus:outline-none"
          >
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

  const [useCase, setUseCase] = useState('');
  const [heardFrom, setHeardFrom] = useState('');
  const [excitedFeatures, setExcitedFeatures] = useState([]);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isTestComplete, setIsTestComplete] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  const handleTestComplete = useCallback((success) => {
    setIsTestComplete(success === true);
  }, []);

  const toggleFeature = useCallback((feature) => {
    setExcitedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
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
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);

    submitTimerRef.current = setTimeout(() => {
      navigate('/', { replace: true, state: { from: 'onboarding' } });
    }, 400);
  }, [navigate, isFormValid, isSubmitting]);

  // ── Theme-aware classes ──
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const pageText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const headerBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const labelText = isWhiteTheme ? "text-gray-700" : "text-zinc-300";
  const descriptionText = isWhiteTheme ? "text-gray-600" : "text-zinc-400";
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none";
  const inputText = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const inputPlaceholder = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const buttonEnabled = "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20";
  const buttonDisabled = isWhiteTheme
    ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300"
    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700";

  const inputBase = `w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`;

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${pageBg} ${pageText}`}>
      {/* Header */}
      <header className={`h-12 flex items-center px-6 border-b shrink-0 ${headerBg} ${borderColor}`}>
        <h1 className="flex-1 text-center text-sm font-semibold tracking-wide select-none">
          🚀 Welcome, {username || 'Developer'}!
        </h1>
        <div className="w-20" />
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6 custom-scrollbar">
        <p className={`text-sm ${descriptionText}`}>
          Let’s personalise your experience. Please answer a few quick questions and run the network latency check.
        </p>

        {/* General Questions */}
        <div className="space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">General Questions</h2>

          {/* Use Case */}
          <div>
            <label htmlFor="useCaseSelect" className={`block text-xs font-medium mb-1 ${labelText}`}>
              What is your primary use case for MockAPI? <span className="text-red-400">*</span>
            </label>
            <select
              id="useCaseSelect"
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
            <label htmlFor="heardFromInput" className={`block text-xs font-medium mb-1 ${labelText}`}>
              How did you hear about us? <span className="text-red-400">*</span>
            </label>
            <input
              id="heardFromInput"
              type="text"
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              placeholder="e.g., Google, Twitter, GitHub, Colleague..."
              className={inputBase}
            />
          </div>

          {/* Excited Features (multi-select) */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>
              What features are you most excited about? <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {featureOptions.map((feature) => (
                <label key={feature} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excitedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="accent-blue-500 w-4 h-4 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  {feature}
                </label>
              ))}
            </div>
            {excitedFeatures.length > 0 && (
              <div className="mt-1.5 text-xs text-zinc-500">
                Selected: {excitedFeatures.join(', ')}
              </div>
            )}
          </div>

          {/* Additional Feedback */}
          <div>
            <label htmlFor="feedbackInput" className={`block text-xs font-medium mb-1 ${labelText}`}>
              Additional feedback (optional)
            </label>
            <textarea
              id="feedbackInput"
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
        <div className={`flex flex-wrap items-center justify-between pt-4 border-t ${borderColor} gap-3`}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="termsCheckbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="accent-blue-500 w-4 h-4 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="termsCheckbox" className={`text-xs ${isWhiteTheme ? 'text-gray-600' : 'text-zinc-400'}`}>
              I agree to the{' '}
              <a href="/terms" className="text-blue-400 hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                Terms & Conditions
              </a>
            </label>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!isFormValid || isSubmitting}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'
            } ${isFormValid && !isSubmitting ? buttonEnabled : buttonDisabled}`}
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
      </main>
    </div>
  );
};

export default React.memo(GeneralQuestionPage);
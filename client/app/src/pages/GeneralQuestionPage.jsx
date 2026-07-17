// src/pages/GeneralQuestionPage.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const cacheRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const runTest = useCallback(async (force = false) => {
    if (!force && cacheRef.current && (Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS)) {
      const cached = cacheRef.current;
      setAverage(cached.result);
      setStats(cached.stats);
      setIndividualResults(cached.individual);
      setStatus('done');
      setSaved(false);
      setError(null);
      onComplete && onComplete(true);
      return;
    }

    setStatus('running');
    setError(null);
    setSaved(false);
    setIndividualResults([]);
    setProgress(0);
    setAverage(null);
    setStats({ min: null, max: null, samples: 0 });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const results = [];
    for (let i = 0; i < DEFAULT_SAMPLE_COUNT; i++) {
      if (signal.aborted) break;
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
        if (err.name === 'AbortError') break;
      }
      setProgress(((i + 1) / DEFAULT_SAMPLE_COUNT) * 100);
      if (i < DEFAULT_SAMPLE_COUNT - 1 && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, DEFAULT_DELAY_MS));
      }
    }

    abortControllerRef.current = null;

    if (signal.aborted) {
      setStatus('idle');
      setProgress(0);
      return;
    }

    if (results.length === 0) {
      setStatus('error');
      setError('All attempts failed. Please check your network or try again.');
      setProgress(100);
      onComplete && onComplete(false);
      return;
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const avgRounded = Math.round(avg);

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

    onComplete && onComplete(true);
  }, [onComplete]);

  const clearCache = () => {
    cacheRef.current = null;
    setStatus('idle');
    setAverage(null);
    setStats({ min: null, max: null, samples: 0 });
    setIndividualResults([]);
    setSaved(false);
    setError(null);
    setProgress(0);
  };

  const renderStatusMessage = () => {
    if (status === 'idle') return 'Press "Run Test" to measure your network latency.';
    if (status === 'running') return `Measuring... (${Math.round(progress)}%)`;
    if (status === 'done') return '✅ Test completed';
    if (status === 'error') return `❌ ${error || 'An error occurred'}`;
    return '';
  };

  const renderIndividualResults = () => {
    if (individualResults.length === 0) return null;
    return (
      <div className="mt-3">
        <p className={`text-xs mb-1 ${isWhiteTheme ? 'text-gray-500' : 'text-zinc-500'}`}>
          Individual ping times (ms):
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {individualResults.map((time, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 border rounded text-xs ${
                isWhiteTheme
                  ? 'bg-gray-100 border-gray-300 text-gray-700'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              {Math.round(time)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Theme‑aware style variables (dark now uses zinc palette)
  const cardBg = isWhiteTheme ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800';
  const textColor = isWhiteTheme ? 'text-gray-800' : 'text-zinc-300';
  const mutedText = isWhiteTheme ? 'text-gray-500' : 'text-zinc-400';
  const resultBg = isWhiteTheme ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800 border-zinc-700';
  const progressBg = isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-700';
  const errorBg = isWhiteTheme ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/20 text-red-400';
  const buttonPrimary = 'bg-blue-600 hover:bg-blue-500 text-white';
  const buttonSecondary = isWhiteTheme
    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700';

  return (
    <div className={`mt-6 p-4 rounded-lg border ${cardBg}`}>
      <h3 className={`text-sm font-semibold ${textColor} mb-3`}>🌐 Network Latency Test</h3>
      <p className={`text-xs ${mutedText} mb-3`}>
        Measures your round‑trip time to the server via 5 ping‑pong requests.
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => runTest(false)}
          disabled={status === 'running'}
          className={`px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50 ${buttonPrimary}`}
        >
          {status === 'running' ? '⏳ Measuring...' : '▶ Run Test'}
        </button>
        {cacheRef.current && (
          <button
            onClick={clearCache}
            className={`px-4 py-2 rounded text-sm transition ${buttonSecondary}`}
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

      <div className={`mt-3 text-sm ${textColor}`}>{renderStatusMessage()}</div>

      {status === 'done' && average !== null && (
        <div className={`mt-3 rounded p-4 text-center border ${resultBg}`}>
          <div className={`text-3xl font-bold ${isWhiteTheme ? 'text-emerald-600' : 'text-emerald-400'}`}>
            {average} ms
          </div>
          <div className={`text-xs ${mutedText} mt-1`}>average round‑trip</div>
          {stats.samples > 0 && (
            <div className="flex justify-center gap-4 mt-2 text-xs text-zinc-500">
              <span>Min: {Math.round(stats.min)} ms</span>
              <span>Max: {Math.round(stats.max)} ms</span>
              <span>Samples: {stats.samples}</span>
            </div>
          )}
          {renderIndividualResults()}
        </div>
      )}

      {status === 'error' && (
        <div className={`mt-3 rounded p-3 text-xs ${errorBg}`}>
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

  const handleTestComplete = (success) => {
    setIsTestComplete(success === true);
  };

  const handleContinue = () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    console.log('Answers:', { useCase, heardFrom, excitedFeatures, additionalFeedback });
    navigate('/', { replace: true });
  };

  const toggleFeature = (feature) => {
    setExcitedFeatures(prev =>
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  const featureOptions = [
    'API Mocking', 'Latency Simulation', 'AI‑Powered Design', 'Real‑Time Analytics', 'Team Collaboration'
  ];

  const isFormValid = 
    useCase.trim() !== '' &&
    heardFrom.trim() !== '' &&
    excitedFeatures.length > 0 &&
    isTestComplete &&
    termsAccepted;

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-150 ${
      isWhiteTheme ? 'bg-white text-gray-800' : 'bg-zinc-950 text-zinc-300'
    }`}>
      {/* Header */}
      <div className={`h-12 flex items-center px-6 border-b shrink-0 ${
        isWhiteTheme ? 'bg-white border-gray-200' : 'bg-zinc-950 border-zinc-800'
      }`}>
        <h1 className="flex-1 text-center text-sm font-semibold tracking-wide select-none text-white">
          🚀 Welcome, {username || 'Guest'}!
        </h1>
        <div className="w-20" />
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        <p className={`text-sm ${isWhiteTheme ? 'text-gray-600' : 'text-zinc-400'}`}>
          Let’s personalise your experience. Please answer a few questions and run the network test.
        </p>

        {/* General Questions */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">General Questions</h2>

          {/* Use Case */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
              What is your primary use case for MockAPI? <span className="text-red-400">*</span>
            </label>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
                isWhiteTheme
                  ? 'bg-gray-50 border border-gray-300 text-gray-900'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
              }`}
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
            <label className={`block text-xs font-medium mb-1 ${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
              How did you hear about us? <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              placeholder="e.g., Google, Twitter, friend..."
              className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
                isWhiteTheme
                  ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder-zinc-500'
              }`}
            />
          </div>

          {/* Excited Features (multi-select) */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
              What features are you most excited about? <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((feature) => (
                <label key={feature} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excitedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="accent-blue-500"
                  />
                  {feature}
                </label>
              ))}
            </div>
          </div>

          {/* Additional Feedback */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
              Additional feedback (optional)
            </label>
            <textarea
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              rows="2"
              placeholder="Anything else you'd like to share?"
              className={`w-full rounded px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
                isWhiteTheme
                  ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder-zinc-500'
              }`}
            />
          </div>
        </div>

        {/* Embedded Network Test (theme‑aware) */}
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
              isFormValid && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-zinc-700 text-zinc-300 cursor-not-allowed'
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
// src/pages/NetworkTest.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/apiClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Default configuration
const DEFAULT_SAMPLE_COUNT = 5;
const DEFAULT_DELAY_MS = 100;
const CACHE_TTL_MS = 30_000; // 30 seconds

function NetworkTest({ projectId, sampleCount = DEFAULT_SAMPLE_COUNT, delayMs = DEFAULT_DELAY_MS }) {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  const [status, setStatus] = useState('idle');
  const [average, setAverage] = useState(null);
  const [stats, setStats] = useState({ min: null, max: null, samples: 0 });
  const [individualResults, setIndividualResults] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const cacheRef = useRef(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  // ---- Lifecycle ----
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

  // ---- Core test logic ----
  const runTest = useCallback(async (force = false) => {
    if (!force && cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS) {
      if (mountedRef.current) {
        const cached = cacheRef.current;
        setAverage(cached.result);
        setStats(cached.stats);
        setIndividualResults(cached.individual);
        setStatus('done');
        setSaved(false);
        setError(null);
      }
      return;
    }

    if (mountedRef.current) {
      setStatus('running');
      setError(null);
      setSaved(false);
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

    for (let i = 0; i < sampleCount; i++) {
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
        const elapsed = performance.now() - start;
        results.push(elapsed);
      } catch (err) {
        if (err.name === 'AbortError' || !mountedRef.current) break;
      }
      if (mountedRef.current) {
        const progressVal = ((i + 1) / sampleCount) * 100;
        setProgress(progressVal);
      }
      if (i < sampleCount - 1 && !signal.aborted && mountedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
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
      return;
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const avgRounded = Math.round(avg);

    setAverage(avgRounded);
    setStats({ min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0, samples: results.length });
    setIndividualResults(results);
    setStatus('done');
    setProgress(100);

    cacheRef.current = {
      result: avgRounded,
      stats: { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0, samples: results.length },
      individual: results,
      timestamp: Date.now(),
    };

    if (projectId) {
      try {
        await apiClient.post('/api/latency-report', {
          project_id: projectId,
          rtts: avgRounded,
        });
        if (mountedRef.current) setSaved(true);
      } catch (_) {
        // Non-blocking telemetry warning
      }
    }
  }, [projectId, sampleCount, delayMs]);

  // ---- Clear cache ----
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
      setSaved(false);
      setError(null);
      setProgress(0);
    }
  }, []);

  // ─── Theme-aware styles ──────────────────────────────────────────
  const textPrimary = isWhiteTheme ? 'text-gray-800' : 'text-white';
  const textMuted = isWhiteTheme ? 'text-gray-500' : 'text-zinc-400';
  const textMini = isWhiteTheme ? 'text-gray-400' : 'text-zinc-500';
  const borderColor = isWhiteTheme ? 'border-gray-200' : 'border-zinc-800';
  const cardBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const progressBg = isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-800';
  const errorBg = isWhiteTheme
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-red-500/10 border-red-500/20 text-red-400';
  const buttonPrimary = 'bg-blue-600 hover:bg-blue-500 text-white';
  const buttonSecondary = isWhiteTheme
    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700';
  const individualPing = isWhiteTheme
    ? 'bg-gray-100 border-gray-300 text-gray-700'
    : 'bg-zinc-900 border-zinc-700 text-zinc-400';

  const getLatencyColor = (ms) => {
    if (ms < 60) return isWhiteTheme ? 'text-emerald-600' : 'text-emerald-400';
    if (ms < 150) return isWhiteTheme ? 'text-blue-600' : 'text-blue-400';
    if (ms < 300) return isWhiteTheme ? 'text-amber-600' : 'text-amber-400';
    return isWhiteTheme ? 'text-rose-600' : 'text-rose-400';
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
      <div className="mt-4">
        <p className={`text-xs ${textMuted} mb-1.5`}>Individual ping times (ms):</p>
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
    );
  };

  return (
    <main className={`p-6 max-w-3xl mx-auto transition-colors duration-200 ${isWhiteTheme ? 'bg-gray-50' : 'bg-zinc-950'} min-h-full`}>
      <h1 className={`text-2xl font-semibold ${textPrimary} mb-2`}>🌐 Network Latency</h1>
      <p className={`text-sm ${textMuted} mb-6`}>
        Measures your round‑trip time to the server via {sampleCount} ping‑pong requests.
        {projectId && ' Results will be saved to the current project.'}
      </p>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => runTest(false)}
          disabled={status === 'running'}
          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'
          }`}
          aria-label="Run network latency test"
        >
          {status === 'running' ? '⏳ Measuring...' : '▶ Run Test'}
        </button>
        {cacheRef.current && (
          <button
            type="button"
            onClick={clearCache}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${buttonSecondary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'
            }`}
            aria-label="Clear cached test results"
          >
            🗑️ Clear Cache
          </button>
        )}
      </div>

      {/* Progress bar */}
      {status === 'running' && (
        <div className={`mt-4 w-full ${progressBg} rounded-full h-2.5`}>
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status message */}
      <div className={`mt-4 text-sm ${textPrimary}`}>{renderStatusMessage()}</div>

      {/* Results */}
      {status === 'done' && average !== null && (
        <div className={`mt-4 border rounded-xl p-6 text-center ${cardBg} ${borderColor} shadow-sm`}>
          <div className={`text-5xl font-bold font-mono ${getLatencyColor(average)}`}>
            {average} ms
          </div>
          <div className={`text-sm ${textMuted} mt-1`}>average round‑trip</div>
          {stats.samples > 0 && (
            <div className={`flex justify-center gap-6 mt-4 text-sm ${textMini}`}>
              <span>Min: {Math.round(stats.min)} ms</span>
              <span>Max: {Math.round(stats.max)} ms</span>
              <span>Samples: {stats.samples}</span>
              {cacheRef.current && (
                <span title="Cached at">
                  🕒 {new Date(cacheRef.current.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
          {saved && (
            <div className="mt-3 text-xs text-emerald-500 font-medium">
              ✅ Result saved to project telemetry
            </div>
          )}
          {renderIndividualResults()}
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className={`mt-4 border rounded-xl p-4 text-sm ${errorBg}`}>
          {error}
          <button
            type="button"
            onClick={() => runTest(true)}
            className="block mt-2 text-blue-400 hover:text-blue-300 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Retry
          </button>
        </div>
      )}
    </main>
  );
}

export default React.memo(NetworkTest);
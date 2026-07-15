// src/pages/NetworkTest.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Default configuration
const DEFAULT_SAMPLE_COUNT = 5;
const DEFAULT_DELAY_MS = 100;
const CACHE_TTL_MS = 30_000; // 30 seconds

function NetworkTest({ projectId, sampleCount = DEFAULT_SAMPLE_COUNT, delayMs = DEFAULT_DELAY_MS }) {
  // ---- State ----
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [average, setAverage] = useState(null);
  const [stats, setStats] = useState({ min: null, max: null, samples: 0 });
  const [individualResults, setIndividualResults] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  // ---- Cache ----
  const cacheRef = useRef(null); // { result, stats, individual, timestamp }

  // ---- Abort controller ----
  const abortControllerRef = useRef(null);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ---- Core test logic ----
  const runTest = useCallback(async (force = false) => {
    // Check cache
    if (!force && cacheRef.current && (Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS)) {
      const cached = cacheRef.current;
      setAverage(cached.result);
      setStats(cached.stats);
      setIndividualResults(cached.individual);
      setStatus('done');
      setSaved(false);
      setError(null);
      return;
    }

    // Reset state
    setStatus('running');
    setError(null);
    setSaved(false);
    setIndividualResults([]);
    setProgress(0);
    setAverage(null);
    setStats({ min: null, max: null, samples: 0 });

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const results = [];
    let successCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      if (signal.aborted) break;

      const start = performance.now();
      try {
        const response = await fetch(`${API_BASE}/api/latency-test`, {
          credentials: 'include',
          signal,
        });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        await response.json(); // ensure body is consumed
        const elapsed = performance.now() - start;
        results.push(elapsed);
        successCount++;
      } catch (err) {
        if (err.name === 'AbortError') {
          // Request was aborted – stop the test
          break;
        }
        // Network or server error – we still continue to the next attempt
        // but we push a sentinel value to indicate failure? We'll just skip.
        // For simplicity, we won't push anything; we'll track failures separately.
        // Actually we want to record attempts even if they fail? We'll just ignore failed attempts.
        // But we need to update progress.
      }

      // Update progress (including failed attempts)
      setProgress(((i + 1) / sampleCount) * 100);

      // Delay between requests (if not last and not aborted)
      if (i < sampleCount - 1 && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Cleanup controller
    abortControllerRef.current = null;

    // If aborted, set status to idle (or done with partial results? We'll treat as idle)
    if (signal.aborted) {
      setStatus('idle');
      setProgress(0);
      return;
    }

    // If no successful results
    if (results.length === 0) {
      setStatus('error');
      setError('All attempts failed. Please check your network or try again.');
      setProgress(100);
      return;
    }

    // Compute stats
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const avgRounded = Math.round(avg);

    // Update state
    setAverage(avgRounded);
    setStats({ min, max, samples: results.length });
    setIndividualResults(results);
    setStatus('done');
    setProgress(100);

    // Cache results
    cacheRef.current = {
      result: avgRounded,
      stats: { min, max, samples: results.length },
      individual: results,
      timestamp: Date.now(),
    };

    // If projectId provided, send report to backend (non‑blocking)
    if (projectId) {
      try {
        await fetch(`${API_BASE}/api/latency-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ project_id: projectId, rtt: avgRounded }),
        });
        setSaved(true);
      } catch (e) {
        console.warn('Failed to save latency report:', e);
        // We don't set an error here – the test itself succeeded
      }
    }
  }, [projectId, sampleCount, delayMs]);

  // ---- Manual cache clear ----
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

  // ---- Render helpers ----
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
        <p className="text-xs text-gray-500 mb-1">Individual ping times (ms):</p>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {individualResults.map((time, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-[#1e1e24] border border-[#3f4147] rounded text-xs text-gray-400"
            >
              {Math.round(time)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // ---- Render ----
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">🌐 Network Latency</h1>
      <p className="text-gray-400 mb-6">
        Measures your round‑trip time to the server via {sampleCount} ping‑pong requests.
        {projectId && ' Results will be saved to the current project.'}
      </p>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => runTest(false)}
          disabled={status === 'running'}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-medium transition"
          aria-label="Run network latency test"
        >
          {status === 'running' ? '⏳ Measuring...' : '▶ Run Test'}
        </button>
        {cacheRef.current && (
          <button
            onClick={clearCache}
            className="px-4 py-3 bg-[#2b2d31] hover:bg-[#3f4147] rounded-xl text-gray-300 text-sm transition"
            aria-label="Clear cached test results"
          >
            🗑️ Clear Cache
          </button>
        )}
      </div>

      {/* Progress bar */}
      {status === 'running' && (
        <div className="mt-4 w-full bg-[#2b2d31] rounded-full h-2.5">
          <div
            className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status message */}
      <div className="mt-4 text-sm text-gray-300">{renderStatusMessage()}</div>

      {/* Results */}
      {status === 'done' && average !== null && (
        <div className="mt-4 bg-[#2b2d31] border border-[#3f4147] rounded-xl p-6 text-center">
          <div className="text-5xl font-bold text-emerald-400">{average} ms</div>
          <div className="text-gray-400 mt-1">average round‑trip</div>
          {stats.samples > 0 && (
            <div className="flex justify-center gap-6 mt-4 text-sm text-gray-500">
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
            <div className="mt-3 text-xs text-emerald-500">
              ✅ Result saved to project latency
            </div>
          )}
          {renderIndividualResults()}
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button
            onClick={() => runTest(true)}
            className="block mt-2 text-indigo-400 hover:text-indigo-300 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default NetworkTest;
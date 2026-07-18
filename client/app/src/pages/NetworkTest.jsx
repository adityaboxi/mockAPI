// src/pages/NetworkTest.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Default configuration
const DEFAULT_SAMPLE_COUNT = 5;
const DEFAULT_DELAY_MS = 100;
const CACHE_TTL_MS = 30_000; // 30 seconds

function NetworkTest({ projectId, sampleCount = DEFAULT_SAMPLE_COUNT, delayMs = DEFAULT_DELAY_MS }) {
  console.log('[NetworkTest] 🚀 Component mounted with projectId:', projectId);

  // ---- State ----
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [average, setAverage] = useState(null);
  const [stats, setStats] = useState({ min: null, max: null, samples: 0 });
  const [individualResults, setIndividualResults] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  // ---- Refs ----
  const cacheRef = useRef(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  // ---- Lifecycle ----
  useEffect(() => {
    mountedRef.current = true;
    console.log('[NetworkTest] ✅ mountedRef set to true');
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      console.log('[NetworkTest] 🧹 Component unmounted, aborting any pending requests');
    };
  }, []);

  // ---- Core test logic ----
  const runTest = useCallback(async (force = false) => {
    console.log('[NetworkTest] ▶️ runTest called with force =', force);

    // Check cache (only if not forced and component is mounted)
    if (!force && cacheRef.current && (Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS)) {
      console.log('[NetworkTest] 💾 Cache HIT – using cached results from', new Date(cacheRef.current.timestamp).toLocaleTimeString());
      if (mountedRef.current) {
        const cached = cacheRef.current;
        setAverage(cached.result);
        setStats(cached.stats);
        setIndividualResults(cached.individual);
        setStatus('done');
        setSaved(false);
        setError(null);
        console.log('[NetworkTest] 📊 Restored cached stats:', cached.stats);
      }
      return;
    }
    console.log('[NetworkTest] 💾 Cache MISS or expired – starting fresh test');

    // Reset state
    if (mountedRef.current) {
      setStatus('running');
      setError(null);
      setSaved(false);
      setIndividualResults([]);
      setProgress(0);
      setAverage(null);
      setStats({ min: null, max: null, samples: 0 });
      console.log('[NetworkTest] 🔄 State reset for new test');
    }

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('[NetworkTest] ⏹️ Aborted previous test');
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const results = [];
    let successCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      if (signal.aborted || !mountedRef.current) break;

      console.log(`[NetworkTest] 📡 Ping attempt ${i + 1}/${sampleCount}`);
      const start = performance.now();
      try {
        const response = await fetch(`${API_BASE}/api/latency-test`, {
          credentials: 'include',
          signal,
        });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        await response.json(); // consume body
        const elapsed = performance.now() - start;
        results.push(elapsed);
        successCount++;
        console.log(`[NetworkTest] ✅ Ping ${i + 1} succeeded – ${elapsed.toFixed(2)} ms`);
      } catch (err) {
        if (err.name === 'AbortError' || !mountedRef.current) {
          console.log(`[NetworkTest] ⏹️ Ping ${i + 1} aborted`);
          break;
        }
        console.warn(`[NetworkTest] ❌ Ping ${i + 1} failed:`, err.message);
        // continue to next attempt
      }

      // Update progress (including failed attempts)
      if (mountedRef.current) {
        const progressVal = ((i + 1) / sampleCount) * 100;
        setProgress(progressVal);
        console.log(`[NetworkTest] 📊 Progress: ${Math.round(progressVal)}%`);
      }

      // Delay between requests (if not last and not aborted)
      if (i < sampleCount - 1 && !signal.aborted && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Cleanup controller
    abortControllerRef.current = null;

    // If aborted or unmounted, set status accordingly
    if (!mountedRef.current) {
      console.log('[NetworkTest] ⏹️ Component unmounted during test – exiting');
      return;
    }
    if (signal.aborted) {
      console.log('[NetworkTest] ⏹️ Test aborted by user');
      setStatus('idle');
      setProgress(0);
      return;
    }

    // If no successful results
    if (results.length === 0) {
      console.warn('[NetworkTest] ❌ No successful pings – all attempts failed');
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

    console.log('[NetworkTest] 📊 Test results:', {
      avg: avgRounded,
      min: Math.round(min),
      max: Math.round(max),
      samples: results.length
    });

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
    console.log('[NetworkTest] 💾 Cached results (TTL = 30s)');

    // If projectId provided, send report to backend (non‑blocking)
    if (projectId) {
      console.log('[NetworkTest] 📤 Sending latency report to /api/latency-report for project:', projectId);
      try {
        const response = await fetch(`${API_BASE}/api/latency-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ project_id: projectId, rtts: avgRounded }),
        });
        if (!response.ok) {
          console.warn('[NetworkTest] ⚠️ Latency report HTTP error:', response.status);
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        console.log('[NetworkTest] ✅ Latency report saved successfully:', result);
        if (mountedRef.current) setSaved(true);
      } catch (e) {
        console.warn('[NetworkTest] ❌ Failed to save latency report:', e);
        // Don't set error – the test itself succeeded
      }
    } else {
      console.log('[NetworkTest] ⏭️ No projectId provided, skipping latency report');
    }

    console.log('[NetworkTest] ✅ Test completed successfully');
  }, [projectId, sampleCount, delayMs]);

  // ---- Manual cache clear ----
  const clearCache = useCallback(() => {
    console.log('[NetworkTest] 🗑️ Clearing cache');
    cacheRef.current = null;
    if (mountedRef.current) {
      setStatus('idle');
      setAverage(null);
      setStats({ min: null, max: null, samples: 0 });
      setIndividualResults([]);
      setSaved(false);
      setError(null);
      setProgress(0);
      console.log('[NetworkTest] 🔄 State reset after cache clear');
    }
  }, []);

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
        <p className="text-xs text-zinc-400 mb-1">Individual ping times (ms):</p>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {individualResults.map((time, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-400"
            >
              {Math.round(time)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const primaryBtn = "bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition disabled:opacity-50";
  const secondaryBtn = "bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition";

  // ---- Render ----
  console.log('[NetworkTest] 🖥️ Rendering – status:', status, '– average:', average, '– saved:', saved);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">🌐 Network Latency</h1>
      <p className="text-zinc-400 mb-6">
        Measures your round‑trip time to the server via {sampleCount} ping‑pong requests.
        {projectId && ' Results will be saved to the current project.'}
      </p>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => runTest(false)}
          disabled={status === 'running'}
          className={`flex-1 py-3 ${primaryBtn}`}
          aria-label="Run network latency test"
        >
          {status === 'running' ? '⏳ Measuring...' : '▶ Run Test'}
        </button>
        {cacheRef.current && (
          <button
            onClick={clearCache}
            className={`px-4 py-3 ${secondaryBtn}`}
            aria-label="Clear cached test results"
          >
            🗑️ Clear Cache
          </button>
        )}
      </div>

      {/* Progress bar */}
      {status === 'running' && (
        <div className="mt-4 w-full bg-zinc-800 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status message */}
      <div className="mt-4 text-sm text-zinc-300">{renderStatusMessage()}</div>

      {/* Results */}
      {status === 'done' && average !== null && (
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <div className="text-5xl font-bold text-emerald-400">{average} ms</div>
          <div className="text-zinc-400 mt-1">average round‑trip</div>
          {stats.samples > 0 && (
            <div className="flex justify-center gap-6 mt-4 text-sm text-zinc-500">
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
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button
            onClick={() => runTest(true)}
            className="block mt-2 text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default NetworkTest;
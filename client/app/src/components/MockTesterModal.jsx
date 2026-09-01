// src/components/MockTesterModal.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const MockTesterModal = ({ isOpen, onClose, endpointData }) => {
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();
  const isWhiteTheme = theme === 'white';

  const [testUrl, setTestUrl] = useState('');
  const [testMethod, setTestMethod] = useState('GET');
  const [testBody, setTestBody] = useState('');
  const [activeTab, setActiveTab] = useState('body'); // 'body' | 'headers'
  const [loading, setLoading] = useState(false);
  const [responseResult, setResponseResult] = useState(null);

  const abortControllerRef = useRef(null);

  // Sync state when endpointData or modal visibility changes
  useEffect(() => {
    if (isOpen && endpointData) {
      setTestUrl(endpointData.url || 'http://localhost:8080/p/project1/v1/api');
      setTestMethod(endpointData.method || 'GET');
      const body = typeof endpointData.requestBody === 'string'
        ? endpointData.requestBody
        : (endpointData.requestBody ? JSON.stringify(endpointData.requestBody, null, 2) : '');
      setTestBody(body);
      setResponseResult(null);
      setActiveTab('body');
    }
  }, [isOpen, endpointData]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  const handleSend = useCallback(async () => {
    if (loading || !testUrl.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setResponseResult(null);
    const startTime = performance.now();

    try {
      const options = {
        method: testMethod,
        headers: {},
        signal: controller.signal,
      };

      if (endpointData?.isAuthEnabled) {
        if (endpointData.authScheme === 'BearerAuth' && endpointData.expectedToken) {
          options.headers['Authorization'] = `Bearer ${endpointData.expectedToken}`;
        } else if (endpointData.authScheme === 'ApiKeyAuth' && endpointData.expectedApiKey) {
          options.headers['x-api-key'] = endpointData.expectedApiKey;
        }
      }

      if (testMethod !== 'GET' && testMethod !== 'HEAD' && testBody.trim()) {
        options.headers['Content-Type'] = 'application/json';
        options.body = testBody;
      }

      const res = await fetch(testUrl, options);
      const duration = Math.round(performance.now() - startTime);

      let bodyData;
      const text = await res.text();
      try {
        bodyData = JSON.parse(text);
      } catch {
        bodyData = text;
      }

      const headersList = [];
      res.headers.forEach((val, key) => {
        headersList.push({ key, val });
      });

      const gatewayLat = res.headers.get('x-gateway-latency') || res.headers.get('x-response-time');

      setResponseResult({
        status: res.status,
        statusText: res.statusText || 'OK',
        duration,
        gatewayLatency: gatewayLat,
        headers: headersList,
        body: bodyData,
      });

      if (res.ok) {
        showSuccess(`HTTP ${res.status} response in ${duration}ms`);
      } else {
        showError(`HTTP ${res.status} received`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      const duration = Math.round(performance.now() - startTime);
      setResponseResult({
        status: 0,
        statusText: 'Network / CORS Error',
        duration,
        headers: [],
        body: { error: err.message || 'Failed to fetch mock endpoint. Is the container running?' },
      });
      showError(`Request failed: ${err.message}`);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [loading, testUrl, testMethod, testBody, endpointData, showSuccess, showError]);

  if (!isOpen) return null;

  const cardBg = isWhiteTheme ? 'bg-white text-gray-800' : 'bg-[#181825] text-zinc-100';
  const borderBg = isWhiteTheme ? 'border-gray-200' : 'border-[#313244]';
  const inputBg = isWhiteTheme ? 'bg-gray-50 border-gray-300 text-gray-800' : 'bg-[#11111b] border-zinc-700 text-zinc-100';

  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status >= 400 && status < 500) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (status >= 500) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    return 'bg-zinc-700 text-zinc-300 border-zinc-600';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mockConsoleTitle"
    >
      <div className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-mono max-h-[90vh] ${cardBg} ${borderBg}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${borderBg}`}>
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">🧪</span>
            <h3 id="mockConsoleTitle" className="text-sm font-bold tracking-wide">
              Live Mock API Console
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close console"
          >
            ✕
          </button>
        </div>

        {/* URL Bar & Send Button */}
        <div className={`p-4 border-b flex items-center gap-2 shrink-0 ${borderBg}`}>
          <select
            value={testMethod}
            onChange={(e) => setTestMethod(e.target.value)}
            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border outline-none ${inputBg}`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="http://localhost:8080/p/..."
            className={`flex-1 px-3 py-2 rounded-lg text-xs border outline-none ${inputBg}`}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !testUrl}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <span>Send ⚡</span>
            )}
          </button>
        </div>

        {/* Console Workspace: Side-by-Side Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#313244]/50 overflow-hidden min-h-[350px]">
          {/* Left: Request Body Config */}
          <div className="flex flex-col p-3 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-[#313244]/50 mb-2">
              <span className="text-[11px] font-bold uppercase text-zinc-400">Request Body (JSON)</span>
              <span className="text-[10px] text-zinc-500">Optional for GET/DELETE</span>
            </div>
            <textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              placeholder='{ "key": "value" }'
              className={`flex-1 p-3 rounded-xl text-xs font-mono border outline-none resize-none overflow-auto custom-scrollbar ${inputBg}`}
            />
          </div>

          {/* Right: Response Inspector */}
          <div className="flex flex-col p-3 overflow-hidden bg-black/10">
            <div className="flex items-center justify-between pb-2 border-b border-[#313244]/50 mb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('body')}
                  className={`text-[11px] font-bold uppercase pb-0.5 transition-colors ${
                    activeTab === 'body' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Body
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('headers')}
                  className={`text-[11px] font-bold uppercase pb-0.5 transition-colors ${
                    activeTab === 'headers' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Headers ({responseResult?.headers?.length || 0})
                </button>
              </div>

              {responseResult && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`px-2 py-0.5 rounded font-bold border ${getStatusBadge(responseResult.status)}`}>
                    {responseResult.status} {responseResult.statusText}
                  </span>
                  <span className="text-purple-400 font-bold">⚡ {responseResult.duration}ms</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              {responseResult ? (
                activeTab === 'body' ? (
                  <pre className="p-3 rounded-xl bg-black/30 border border-[#313244]/50 text-xs font-mono overflow-auto h-full text-emerald-400 select-all leading-relaxed custom-scrollbar">
                    <code>{typeof responseResult.body === 'object' ? JSON.stringify(responseResult.body, null, 2) : responseResult.body}</code>
                  </pre>
                ) : (
                  <div className="p-3 rounded-xl bg-black/30 border border-[#313244]/50 h-full overflow-auto custom-scrollbar space-y-1.5">
                    {responseResult.headers.length > 0 ? (
                      responseResult.headers.map((h, i) => (
                        <div key={i} className="text-xs font-mono flex items-start gap-2">
                          <span className="text-blue-400 font-bold shrink-0">{h.key}:</span>
                          <span className="text-zinc-300 break-all">{h.val}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500">No response headers captured.</span>
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs gap-1">
                  <span>No response yet</span>
                  <span className="text-[10px] text-zinc-600">Click Send to test mock route</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end px-4 py-2.5 border-t shrink-0 ${borderBg}`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(MockTesterModal);
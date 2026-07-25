// src/pages/OpenApi.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ---------- Constants ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/json', 'application/yaml', 'text/yaml', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.json', '.yaml', '.yml'];

// ---------- Helper: validate OpenAPI spec content ----------
function validateOpenApiSpec(content, isJson) {
  let spec;
  try {
    spec = isJson ? JSON.parse(content) : require('js-yaml').load(content);
  } catch (e) {
    return { valid: false, error: `Invalid ${isJson ? 'JSON' : 'YAML'} format: ${e.message}` };
  }

  if (!spec.openapi && !spec.swagger) {
    return { valid: false, error: 'Missing "openapi" or "swagger" field – not a valid OpenAPI spec.' };
  }
  if (!spec.paths || typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
    return { valid: false, error: 'Missing "paths" field or no endpoints defined.' };
  }
  return { valid: true, spec };
}

// ---------- Component ----------
function OpenApi() {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState({ type: '', message: '', detail: '' });
  const [dragActive, setDragActive] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const lastJobIdRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const validateFile = useCallback(async (file) => {
    if (!file) return { valid: false, error: 'No file selected' };
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
    }
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
    const isValidType = ALLOWED_TYPES.includes(file.type);
    if (!isValidType && !isValidExt) {
      return { valid: false, error: 'Invalid file type. Please upload JSON or YAML.' };
    }
    try {
      const content = await file.text();
      const isJson = file.name.endsWith('.json') || file.type === 'application/json';
      const result = validateOpenApiSpec(content, isJson);
      if (!result.valid) {
        return { valid: false, error: result.error };
      }
      return { valid: true, spec: result.spec };
    } catch (e) {
      return { valid: false, error: `Failed to read file: ${e.message}` };
    }
  }, []);

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setStatus({ type: '', message: '', detail: '' });
    const result = await validateFile(f);
    if (!result.valid) {
      setStatus({ type: 'error', message: 'Invalid file', detail: result.error });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
    setStatus({ type: '', message: '', detail: '' });
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setStatus({ type: '', message: '', detail: '' });
    const result = await validateFile(f);
    if (!result.valid) {
      setStatus({ type: 'error', message: 'Invalid file', detail: result.error });
      setFile(null);
      return;
    }
    setFile(f);
    setStatus({ type: '', message: '', detail: '' });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    setFile(null);
    setProjectName('');
    setStatus({ type: '', message: '', detail: '' });
    setUploadProgress(0);
    setJobId(null);
    setLoading(false);
    setRetryCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pollJobStatus = useCallback(async (jobId, attempts = 0) => {
    if (!mountedRef.current) return;
    const MAX_ATTEMPTS = 90;
    if (attempts >= MAX_ATTEMPTS) {
      setStatus({
        type: 'error',
        message: '⏰ Import timed out',
        detail: 'The import is taking too long. You can retry or check server logs.',
      });
      setLoading(false);
      setUploadProgress(0);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/import-status/${jobId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.progress !== undefined) setUploadProgress(data.progress);
      setStatus({
        type: data.status === 'completed' ? 'success' : 'loading',
        message: data.message || 'Processing...',
        detail: data.detail || '',
      });
      if (data.status === 'completed') {
        setLoading(false);
        setUploadProgress(100);
        setFile(null);
        setProjectName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setJobId(null);
        setRetryCount(0);
        return;
      }
      if (data.status === 'failed') {
        setStatus({
          type: 'error',
          message: '❌ Import failed',
          detail: data.detail || 'The import job failed.',
        });
        setLoading(false);
        setUploadProgress(0);
        setJobId(null);
        return;
      }
      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(jobId, attempts + 1);
      }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus({
        type: 'error',
        message: '❌ Status check failed',
        detail: err.message || 'Unable to retrieve job status',
      });
      setLoading(false);
      setJobId(null);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!file || loading) return;
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Project name required', detail: 'Please enter a project name.' });
      return;
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setUploadProgress(0);
    setJobId(null);
    setRetryCount(0);
    setStatus({ type: 'loading', message: '⏳ Uploading...', detail: 'Preparing file...' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectName', trimmedName);

    try {
      const response = await fetch(`${API_BASE}/api/import-openapi`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) {
        let errorMsg = `Server responded with ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      if (!mountedRef.current) return;
      setJobId(data.jobId);
      setStatus({
        type: 'loading',
        message: '⏳ Import queued...',
        detail: `Job ${data.jobId} is being processed.`,
      });
      setUploadProgress(10);
      lastJobIdRef.current = data.jobId;
      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(data.jobId, 0);
      }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === 'AbortError') {
        setStatus({ type: 'error', message: '⏹️ Upload cancelled', detail: 'The import was aborted.' });
      } else {
        setStatus({
          type: 'error',
          message: '❌ Import failed',
          detail: err.message || 'Unknown error occurred',
        });
      }
      setLoading(false);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  }, [file, loading, projectName, pollJobStatus]);

  const handleRetry = useCallback(() => {
    if (lastJobIdRef.current) {
      setRetryCount(prev => prev + 1);
      setStatus({ type: 'loading', message: '⏳ Retrying...', detail: `Attempt ${retryCount + 1}` });
      setLoading(true);
      setUploadProgress(0);
      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(lastJobIdRef.current, 0);
      }, 2000);
    } else {
      handleImport();
    }
  }, [retryCount, handleImport]);

  // ─── Theme-aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? 'bg-gray-50' : 'bg-zinc-950';
  const textPrimary = isWhiteTheme ? 'text-gray-800' : 'text-white';
  const textMuted = isWhiteTheme ? 'text-gray-500' : 'text-zinc-400';
  const textMini = isWhiteTheme ? 'text-gray-400' : 'text-zinc-500';
  const borderColor = isWhiteTheme ? 'border-gray-200' : 'border-zinc-800';
  const inputBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const inputBorder = isWhiteTheme ? 'border-gray-300' : 'border-zinc-700';
  const inputFocus = 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none';
  const inputText = isWhiteTheme ? 'text-gray-800' : 'text-zinc-200';
  const inputPlaceholder = isWhiteTheme ? 'placeholder-gray-400' : 'placeholder-zinc-500';
  const dropBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const dropBorder = isWhiteTheme
    ? 'border-gray-300 hover:border-indigo-400'
    : 'border-zinc-700 hover:border-indigo-400';
  const dropActiveBg = isWhiteTheme ? 'bg-indigo-50' : 'bg-indigo-500/10';
  const dropActiveBorder = 'border-indigo-400';
  const fileInfoBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const fileInfoBorder = isWhiteTheme ? 'border-gray-200' : 'border-zinc-700';
  const progressBg = isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-800';
  const buttonPrimary = 'bg-blue-600 hover:bg-blue-500 text-white';
  const buttonSecondary = isWhiteTheme
    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300';
  const buttonRetry = 'bg-yellow-600 hover:bg-yellow-500 text-white';
  const statusSuccess = isWhiteTheme
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  const statusError = isWhiteTheme
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-red-500/10 border-red-500/20 text-red-400';
  const statusLoading = isWhiteTheme
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : 'bg-blue-500/10 border-blue-500/20 text-blue-400';

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className={`p-6 max-w-3xl mx-auto transition-colors duration-200 ${pageBg} ${textPrimary} min-h-full`}>
      <h1 className="text-2xl font-semibold mb-2">📂 Import OpenAPI</h1>
      <p className={`text-sm ${textMuted} mb-6`}>
        Upload a JSON or YAML file to automatically create all endpoints.
      </p>

      {/* Project Name */}
      <div className="mb-5">
        <label htmlFor="projectName" className={`block text-sm font-medium ${textMuted} mb-1.5`}>
          Project Name <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Enter project name (e.g., my-api-project)"
          className={inputClass}
          disabled={loading}
        />
        <p className={`text-xs ${textMini} mt-1`}>
          This name will be used to identify your project in the dashboard.
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer
          ${dragActive ? `${dropActiveBorder} ${dropActiveBg}` : `${dropBorder} ${dropBg}`}
          focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
          ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'}
        `}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <div className="text-5xl mb-2">📄</div>
        <div className={`${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
          <strong className="text-indigo-400">Click to browse</strong> or drag & drop
        </div>
        <div className={`text-sm ${textMuted} mt-1`}>JSON / YAML files only (max 10 MB)</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* File info */}
      {file && (
        <div className={`mt-4 flex items-center justify-between border rounded-xl px-4 py-3 ${fileInfoBg} ${fileInfoBorder}`}>
          <span className={`truncate max-w-[200px] ${isWhiteTheme ? 'text-gray-800' : 'text-zinc-300'}`}>
            {file.name}
          </span>
          <span className={`text-sm ${textMini}`}>{(file.size / 1024).toFixed(1)} KB</span>
          <button
            onClick={handleClear}
            className={`text-red-400 hover:text-red-300 text-xl leading-none transition-colors`}
            aria-label="Remove selected file"
          >
            ✕
          </button>
        </div>
      )}

      {/* Progress bar */}
      {loading && (
        <div className={`mt-4 w-full ${progressBg} rounded-full h-2.5`}>
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Buttons */}
      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={handleImport}
          disabled={!file || loading || !projectName.trim()}
          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'}`}
        >
          {loading ? `⏳ ${Math.round(uploadProgress)}%` : '🚀 Import'}
        </button>
        <button
          onClick={handleClear}
          className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${buttonSecondary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'}`}
        >
          {loading ? 'Cancel' : 'Clear'}
        </button>
        {status.type === 'error' && jobId && (
          <button
            onClick={handleRetry}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${buttonRetry} focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'}`}
          >
            🔁 Retry
          </button>
        )}
      </div>

      {/* Status messages */}
      {status.type && (
        <div
          className={`mt-4 p-4 rounded-xl border ${
            status.type === 'success'
              ? statusSuccess
              : status.type === 'error'
              ? statusError
              : statusLoading
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="font-medium">{status.message}</div>
          {status.detail && <div className="text-sm opacity-70 mt-1">{status.detail}</div>}
        </div>
      )}

      {status.type === 'success' && (
        <div className={`mt-4 text-xs ${textMini} text-center border-t ${borderColor} pt-3`}>
          💡 You can now view your new project in the Dashboard.
        </div>
      )}
    </div>
  );
}

export default OpenApi;
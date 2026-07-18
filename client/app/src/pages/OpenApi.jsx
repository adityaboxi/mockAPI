// src/pages/OpenApi.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ---------- Constants ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/json', 'application/yaml', 'text/yaml', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.json', '.yaml', '.yml'];

// ---------- Component ----------
function OpenApi() {
  // ---- State ----
  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState({ type: '', message: '', detail: '' });
  const [dragActive, setDragActive] = useState(false);
  const [jobId, setJobId] = useState(null);

  // ---- Refs ----
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // ---- Lifecycle ----
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel any ongoing request and polling
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, []);

  // ---- Helper: validate file ----
  const validateFile = (file) => {
    if (!file) return { valid: false, error: 'No file selected' };

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
    }

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
    const isValidType = ALLOWED_TYPES.includes(file.type);

    // Accept if either type or extension is allowed (some browsers misreport MIME)
    if (!isValidType && !isValidExt) {
      return { valid: false, error: 'Invalid file type. Please upload JSON or YAML.' };
    }

    return { valid: true, error: null };
  };

  // ---- File selection handlers ----
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      const validation = validateFile(f);
      if (!validation.valid) {
        setStatus({ type: 'error', message: 'Invalid file', detail: validation.error });
        setFile(null);
        return;
      }
      setFile(f);
      setStatus({ type: '', message: '', detail: '' });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      const validation = validateFile(f);
      if (!validation.valid) {
        setStatus({ type: 'error', message: 'Invalid file', detail: validation.error });
        setFile(null);
        return;
      }
      setFile(f);
      setStatus({ type: '', message: '', detail: '' });
    }
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
    // Cancel ongoing operations
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---- Poll job status (with timeout) ----
  const pollJobStatus = useCallback(async (jobId, attempts = 0) => {
    const MAX_ATTEMPTS = 60; // 2 minutes (60 * 2s)
    if (attempts >= MAX_ATTEMPTS) {
      if (mountedRef.current) {
        setStatus({
          type: 'error',
          message: '⏰ Import timed out',
          detail: 'The import is taking too long. Please try again.',
        });
        setLoading(false);
        setUploadProgress(0);
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/import-status/${jobId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!mountedRef.current) return;

      // Update progress if provided
      if (data.progress !== undefined) {
        setUploadProgress(data.progress);
      }

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

      // Still processing – poll again
      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(jobId, attempts + 1);
      }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[pollJobStatus] Error:', err);
      setStatus({
        type: 'error',
        message: '❌ Status check failed',
        detail: err.message || 'Unable to retrieve job status',
      });
      setLoading(false);
      setJobId(null);
    }
  }, []);

  // ---- Import logic ----
  const handleImport = useCallback(async () => {
    if (!file || loading) return;
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setStatus({ type: 'error', message: 'Project name required', detail: 'Please enter a project name.' });
      return;
    }

    // Cancel any ongoing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setUploadProgress(0);
    setJobId(null);
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
        } catch (_) { /* ignore */ }
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

      // Start polling
      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(data.jobId, 0);
      }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === 'AbortError') {
        setStatus({
          type: 'error',
          message: '⏹️ Upload cancelled',
          detail: 'The import was aborted.',
        });
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

  // ---- Render ----
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-4">📂 Import OpenAPI</h1>
      <p className="text-zinc-400 mb-6">
        Upload a JSON or YAML file to automatically create all endpoints.
      </p>

      {/* Project Name */}
      <div className="mb-4">
        <label htmlFor="projectName" className="block text-sm font-medium text-zinc-300 mb-1">
          Project Name <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Enter project name (e.g., my-api-project)"
          className="w-full rounded px-4 py-2 text-sm bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          disabled={loading}
          aria-describedby="projectNameHelp"
        />
        <p id="projectNameHelp" className="text-xs text-zinc-500 mt-1">
          This name will be used to identify your project in the dashboard.
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragActive
            ? 'border-indigo-400 bg-indigo-500/10'
            : 'border-zinc-800 hover:border-indigo-400 bg-zinc-900'
        } cursor-pointer`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Click or drag to upload OpenAPI file"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <div className="text-5xl mb-2">📄</div>
        <div className="text-zinc-300">
          <strong className="text-indigo-400">Click to browse</strong> or drag & drop
        </div>
        <div className="text-zinc-500 text-sm mt-1">JSON / YAML files only (max 10 MB)</div>
        <input
          ref={fileInputRef}
          id="fileInput"
          type="file"
          accept=".json,.yaml,.yml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* File info */}
      {file && (
        <div className="mt-4 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <span className="text-zinc-300 truncate max-w-[200px]">{file.name}</span>
          <span className="text-zinc-500 text-sm">{(file.size / 1024).toFixed(1)} KB</span>
          <button
            onClick={handleClear}
            className="text-red-400 hover:text-red-300 text-xl leading-none"
            aria-label="Remove selected file"
          >
            ✕
          </button>
        </div>
      )}

      {/* Progress bar */}
      {loading && (
        <div className="mt-4 w-full bg-zinc-800 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleImport}
          disabled={!file || loading || !projectName.trim()}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-medium transition"
          aria-label="Import the selected file"
        >
          {loading ? `⏳ ${Math.round(uploadProgress)}%` : '🚀 Import'}
        </button>
        <button
          onClick={handleClear}
          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 transition"
          aria-label="Clear selected file and cancel upload if active"
        >
          {loading ? 'Cancel' : 'Clear'}
        </button>
      </div>

      {/* Status messages */}
      {status.type && (
        <div
          className={`mt-4 p-4 rounded-xl border ${
            status.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : status.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="font-medium">{status.message}</div>
          {status.detail && <div className="text-sm opacity-70 mt-1">{status.detail}</div>}
        </div>
      )}

      {status.type === 'success' && (
        <div className="mt-4 text-xs text-zinc-500 text-center border-t border-zinc-800 pt-3">
          💡 You can now view your new project in the Dashboard.
        </div>
      )}
    </div>
  );
}

export default OpenApi;
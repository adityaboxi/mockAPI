// src/pages/OpenApi.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Maximum file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/json', 'application/yaml', 'text/yaml', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.json', '.yaml', '.yml'];

function OpenApi() {
  // ---- State ----
  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState({ type: '', message: '', detail: '' });
  const [dragActive, setDragActive] = useState(false);
  const [jobId, setJobId] = useState(null);
  const fileInputRef = useRef(null);

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

  // ---- Helper: validate file ----
  const validateFile = (file) => {
    if (!file) return { valid: false, error: 'No file selected' };

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
    }

    const isValidType = ALLOWED_TYPES.includes(file.type);
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

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
    setFile(null);
    setProjectName('');
    setStatus({ type: '', message: '', detail: '' });
    setUploadProgress(0);
    setJobId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  // ---- Poll job status ----
  const pollJobStatus = useCallback(async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/api/import-status/${jobId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();

      setStatus({
        type: data.status === 'completed' ? 'success' : 'loading',
        message: data.message || 'Processing...',
        detail: data.detail || '',
      });

      if (data.status === 'completed' || data.status === 'failed') {
        setLoading(false);
        setUploadProgress(100);
        if (data.status === 'completed') {
          setFile(null);
          setProjectName('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
        return;
      }

      setTimeout(() => pollJobStatus(jobId), 2000);
    } catch (err) {
      console.error('[pollJobStatus] Error:', err);
    }
  }, []);

  // ---- Import logic using fetch ----
  const handleImport = useCallback(async () => {
    if (!file || loading) return;
    if (!projectName.trim()) {
      setStatus({ type: 'error', message: 'Project name required', detail: 'Please enter a project name.' });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setUploadProgress(0);
    setJobId(null);
    setStatus({ type: 'loading', message: '⏳ Uploading...', detail: 'Preparing file...' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectName', projectName.trim());

    try {
      const response = await fetch(`${API_BASE}/api/import-openapi`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      setJobId(data.jobId);
      setStatus({
        type: 'loading',
        message: '⏳ Import queued...',
        detail: `Job ${data.jobId} is being processed by the worker.`,
      });

      pollJobStatus(data.jobId);
    } catch (err) {
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
    }
  }, [file, loading, projectName, pollJobStatus]);

  // ---- Render ----
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-4">📂 Import OpenAPI</h1>
      <p className="text-gray-400 mb-6">
        Upload a JSON or YAML file to automatically create all endpoints.
      </p>

      {/* Project Name Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Project Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Enter project name (e.g., my-api-project)"
          className="w-full rounded px-4 py-2 text-sm bg-[#1e1e24] border border-[#3f4147] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          disabled={loading}
        />
      </div>

      {/* File Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragActive
            ? 'border-indigo-400 bg-indigo-950/20'
            : 'border-[#3f4147] hover:border-indigo-400 bg-[#1e1e24]'
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
        <div className="text-gray-300">
          <strong className="text-indigo-400">Click to browse</strong> or drag & drop
        </div>
        <div className="text-gray-500 text-sm mt-1">JSON / YAML files only (max 10 MB)</div>
        <input
          ref={fileInputRef}
          id="fileInput"
          type="file"
          accept=".json,.yaml,.yml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between bg-[#2b2d31] border border-[#3f4147] rounded-xl px-4 py-3">
          <span className="text-gray-200 truncate">{file.name}</span>
          <span className="text-gray-500 text-sm">{(file.size / 1024).toFixed(1)} KB</span>
          <button onClick={handleClear} className="text-red-400 hover:text-red-300 text-xl leading-none">✕</button>
        </div>
      )}

      {/* Upload progress bar */}
      {loading && (
        <div className="mt-4 w-full bg-[#2b2d31] rounded-full h-2.5">
          <div
            className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleImport}
          disabled={!file || loading || !projectName.trim()}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-medium transition"
          aria-label="Import the selected file"
        >
          {loading ? `⏳ ${uploadProgress}%` : '🚀 Import'}
        </button>
        <button
          onClick={handleClear}
          className="px-6 py-3 bg-[#2d2d3a] hover:bg-[#3a3a4a] rounded-xl text-gray-300 transition"
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
              ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400'
              : status.type === 'error'
              ? 'bg-red-950/30 border-red-500 text-red-400'
              : 'bg-indigo-950/30 border-indigo-500 text-indigo-400'
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="font-medium">{status.message}</div>
          {status.detail && <div className="text-sm opacity-70 mt-1">{status.detail}</div>}
        </div>
      )}

      {status.type === 'success' && (
        <div className="mt-4 text-xs text-gray-500 text-center border-t border-[#2a2a30] pt-3">
          💡 You can now view your new project in the Dashboard.
        </div>
      )}
    </div>
  );
}

export default OpenApi;
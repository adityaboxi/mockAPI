// src/pages/OpenApi.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
function OpenApi({ selectedProjectId, onProjectSelect, onProjectRefresh }) {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  // ─── State ──────────────────────────────────────────────────────
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState(null);
  const [projectName, setProjectName] = useState(''); // ✅ ADD THIS
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState({ type: '', message: '', detail: '', code: '' });
  const [dragActive, setDragActive] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [importedEndpoints, setImportedEndpoints] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const lastJobIdRef = useRef(null);

  // ─── Lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // ─── When selected project changes, update project name ──────
  useEffect(() => {
    if (selectedProjectId) {
      const selected = projects.find(p => p.id === selectedProjectId);
      if (selected) {
        setProjectName(selected.projectname || selected.id);
      }
    }
  }, [selectedProjectId, projects]);

  // ─── Fetch user's projects ─────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      
      const projs = Array.isArray(data) ? data : [];
      setProjects(projs);
      
      // If no project selected and we have projects, select first one
      if (!selectedProjectId && projs.length > 0) {
        onProjectSelect?.(projs[0].id);
      }
    } catch (err) {
      if (mountedRef.current) setProjectError(err.message);
    } finally {
      if (mountedRef.current) setLoadingProjects(false);
    }
  }, [selectedProjectId, onProjectSelect]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ─── Validate file ──────────────────────────────────────────────
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

  // ─── Handle file selection ──────────────────────────────────────
  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setStatus({ type: '', message: '', detail: '', code: '' });
    const result = await validateFile(f);
    if (!result.valid) {
      setStatus({ type: 'error', message: 'Invalid file', detail: result.error, code: 'INVALID_FILE' });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
    setImportedEndpoints(0);
    setStatus({ type: '', message: '', detail: '', code: '' });
  };

  // ─── Drag & Drop handlers ──────────────────────────────────────
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setStatus({ type: '', message: '', detail: '', code: '' });
    const result = await validateFile(f);
    if (!result.valid) {
      setStatus({ type: 'error', message: 'Invalid file', detail: result.error, code: 'INVALID_FILE' });
      setFile(null);
      return;
    }
    setFile(f);
    setImportedEndpoints(0);
    setStatus({ type: '', message: '', detail: '', code: '' });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  // ─── Clear all state ────────────────────────────────────────────
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
    setStatus({ type: '', message: '', detail: '', code: '' });
    setUploadProgress(0);
    setJobId(null);
    setLoading(false);
    setRetryCount(0);
    setImportedEndpoints(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Poll job status ────────────────────────────────────────────
  const pollJobStatus = useCallback(async (jobId, attempts = 0) => {
    if (!mountedRef.current) return;
    const MAX_ATTEMPTS = 90;
    if (attempts >= MAX_ATTEMPTS) {
      setStatus({
        type: 'error',
        message: '⏰ Import timed out',
        detail: 'The import is taking too long. You can retry or check server logs.',
        code: 'TIMEOUT'
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
        code: data.status || 'processing'
      });

      if (data.status === 'completed') {
        setLoading(false);
        setUploadProgress(100);
        if (data.result?.endpoints) {
          setImportedEndpoints(data.result.endpoints);
        }
        fetchProjects();
        onProjectRefresh?.();
        setFile(null);
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
          code: 'IMPORT_FAILED'
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
        code: 'STATUS_CHECK_FAILED'
      });
      setLoading(false);
      setJobId(null);
    }
  }, [fetchProjects, onProjectRefresh]);

  // ─── Import handler ────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!file || loading) return;
    
    // 🚨 CRITICAL: Check if project is selected
    if (!selectedProjectId) {
      setStatus({
        type: 'error',
        message: '⚠️ No project selected',
        detail: 'Please select a project from the left sidebar first.',
        code: 'NO_PROJECT_SELECTED'
      });
      return;
    }

    // Check if selected project exists in the list
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) {
      setStatus({
        type: 'error',
        message: '⚠️ Project not found',
        detail: 'The selected project no longer exists. Please refresh and select again.',
        code: 'PROJECT_NOT_FOUND'
      });
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
    setImportedEndpoints(0);
    setStatus({ type: 'loading', message: '⏳ Uploading...', detail: 'Preparing file...', code: '' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', selectedProjectId);
    formData.append('projectName', selectedProject.projectname || selectedProject.id);

    try {
      const response = await fetch(`${API_BASE}/api/import-openapi`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes from backend
        if (data.code === 'PROJECT_NOT_FOUND') {
          setStatus({
            type: 'error',
            message: '⚠️ Project not found or access denied',
            detail: data.message || 'You do not have access to this project. Please select another project.',
            code: 'PROJECT_NOT_FOUND'
          });
          // Refresh project list to update state
          fetchProjects();
          setLoading(false);
          setUploadProgress(0);
          return;
        }

        let errorMsg = data.error || `Server responded with ${response.status}`;
        setStatus({
          type: 'error',
          message: '❌ Import failed',
          detail: errorMsg,
          code: data.code || 'UNKNOWN_ERROR'
        });
        setLoading(false);
        setUploadProgress(0);
        abortControllerRef.current = null;
        return;
      }

      if (!mountedRef.current) return;

      setJobId(data.jobId);
      setStatus({
        type: 'loading',
        message: '⏳ Import queued...',
        detail: `Job ${data.jobId} is being processed by BullMQ.`,
        code: 'QUEUED'
      });
      setUploadProgress(10);
      lastJobIdRef.current = data.jobId;

      pollTimeoutRef.current = setTimeout(() => {
        pollJobStatus(data.jobId, 0);
      }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === 'AbortError') {
        setStatus({ type: 'error', message: '⏹️ Upload cancelled', detail: 'The import was aborted.', code: 'ABORTED' });
      } else {
        setStatus({
          type: 'error',
          message: '❌ Import failed',
          detail: err.message || 'Unknown error occurred',
          code: 'NETWORK_ERROR'
        });
      }
      setLoading(false);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  }, [file, loading, selectedProjectId, projects, pollJobStatus, fetchProjects]);

  // ─── Retry handler ─────────────────────────────────────────────
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
  }, [retryCount, handleImport, pollJobStatus]);

  // ─── Filter projects ────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(proj =>
      (proj.projectname || proj.id)?.toLowerCase().includes(term) ||
      proj.id?.toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  // ─── Theme-aware styles ────────────────────────────────────────
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
  const sidebarBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const noProjectBg = isWhiteTheme ? 'bg-gray-100' : 'bg-zinc-800/30';

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className={`flex h-full ${pageBg} transition-colors duration-200`}>
      {/* ====== LEFT SIDEBAR: Project List ====== */}
      <div className={`w-64 shrink-0 border-r flex flex-col ${sidebarBg} ${borderColor}`}>
        <div className={`px-4 py-3 border-b ${borderColor} text-xs font-semibold uppercase ${textMuted} flex justify-between items-center`}>
          <span className="flex items-center gap-2">
            <span>📁</span> Projects
          </span>
          <button
            onClick={fetchProjects}
            className={`${textMuted} hover:${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'} transition-colors`}
            aria-label="Refresh projects"
          >
            ⟳
          </button>
        </div>

        <div className="p-3">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${inputText} ${inputPlaceholder}`}
            aria-label="Search projects"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loadingProjects ? (
            <div className={`text-sm text-center py-4 ${textMuted} animate-pulse`}>
              Loading projects...
            </div>
          ) : projectError ? (
            <div className={`text-sm text-center py-4 text-red-400`}>
              Error: {projectError}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className={`text-sm text-center py-4 ${textMuted}`}>
              {searchTerm ? 'No matching projects' : 'No projects found. Create one first.'}
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredProjects.map((proj) => {
                const isSelected = selectedProjectId === proj.id;
                const displayName = proj.projectname || proj.id;
                return (
                  <li key={proj.id}>
                    <button
                      onClick={() => onProjectSelect?.(proj.id)}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150
                        ${isSelected
                          ? isWhiteTheme
                            ? 'bg-blue-100 text-blue-700 border-l-2 border-blue-500'
                            : 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500'
                          : isWhiteTheme
                            ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                            : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                        }
                      `}
                      aria-selected={isSelected}
                      role="option"
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{displayName}</span>
                        <span className={`text-xs ${isSelected ? (isWhiteTheme ? 'text-blue-600' : 'text-blue-300') : textMuted}`}>
                          {proj.isCreator ? '👑' : '👤'}
                        </span>
                      </div>
                      <div className={`text-[10px] ${textMuted} truncate`}>
                        {proj.id}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={`px-4 py-2 border-t ${borderColor} text-xs ${textMuted}`}>
          {selectedProject && (
            <span className="truncate block">
              Selected: <span className="font-medium">{selectedProject.projectname || selectedProject.id}</span>
            </span>
          )}
        </div>
      </div>

      {/* ====== MAIN CONTENT: Upload Area ====== */}
      <div className={`flex-1 overflow-auto p-6 max-w-3xl mx-auto ${pageBg} ${textPrimary}`}>
        <h1 className="text-2xl font-semibold mb-2">📂 Import OpenAPI</h1>
        <p className={`text-sm ${textMuted} mb-6`}>
          Upload a JSON or YAML file to automatically create all endpoints for the selected project.
        </p>

        {/* Project Selection Status */}
        <div className={`mb-6 p-4 rounded-xl border ${selectedProject ? fileInfoBg : noProjectBg} ${fileInfoBorder}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${textMuted}`}>Selected Project</span>
            <span className={`text-sm font-mono font-medium ${selectedProject ? textPrimary : 'text-yellow-400'}`}>
              {selectedProject?.projectname || selectedProject?.id || '⚠️ No project selected'}
            </span>
          </div>
          {!selectedProject && (
            <p className={`text-xs ${textMuted} mt-1`}>
              Please select a project from the left sidebar to import APIs into.
            </p>
          )}
        </div>

        {/* Project Name (auto-filled from selection) */}
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
            disabled={loading || !!selectedProjectId}
          />
          <p className={`text-xs ${textMini} mt-1`}>
            {selectedProjectId 
              ? 'Project name is auto-filled from the selected project.' 
              : 'This name will be used to identify your project in the dashboard.'}
          </p>
        </div>

        {/* File Drop Zone - disabled if no project */}
        <div
          onDragOver={selectedProject ? handleDragOver : undefined}
          onDragLeave={selectedProject ? handleDragLeave : undefined}
          onDrop={selectedProject ? handleDrop : undefined}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
            ${!selectedProject
              ? 'opacity-50 cursor-not-allowed border-zinc-700 bg-zinc-800/20'
              : dragActive
                ? `${dropActiveBorder} ${dropActiveBg} cursor-pointer`
                : `${dropBorder} ${dropBg} cursor-pointer`
            }
            focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
            ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-950'}
          `}
          onClick={() => selectedProject && fileInputRef.current?.click()}
          role="button"
          tabIndex={selectedProject ? 0 : -1}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && selectedProject) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="text-5xl mb-2">📄</div>
          <div className={`${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'}`}>
            <strong className="text-indigo-400">Click to browse</strong> or drag & drop
          </div>
          <div className={`text-sm ${textMuted} mt-1`}>
            JSON / YAML files only (max 10 MB)
            {!selectedProject && <span className="block text-yellow-400 mt-2">⚠️ Select a project first</span>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleFileChange}
            className="hidden"
            disabled={!selectedProject}
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
            disabled={!file || loading || !selectedProject}
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
            {status.type === 'success' && importedEndpoints > 0 && (
              <div className="text-sm mt-2 font-medium">
                ✅ Imported {importedEndpoints} endpoints successfully into the project!
              </div>
            )}
            {status.type === 'success' && (
              <div className="text-xs mt-1 opacity-70">
                🔄 The project container is being updated with the new routes.
              </div>
            )}
          </div>
        )}

        {status.type === 'success' && (
          <div className={`mt-4 text-xs ${textMini} text-center border-t ${borderColor} pt-3`}>
            💡 The endpoints are now being synced to your project container via BullMQ.
          </div>
        )}

        {/* BullMQ Info */}
        <div className={`mt-6 text-xs ${textMini} text-center border-t ${borderColor} pt-4`}>
          <span className="flex items-center justify-center gap-2">
            <span>⚙️</span>
            <span>APIs are processed asynchronously via BullMQ workers</span>
            <span>•</span>
            <span>Project container sync in progress</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default OpenApi;
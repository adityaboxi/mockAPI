// src/pages/Dashboard.jsx
import React, {
  useState, useEffect, useMemo, useCallback, useRef, memo
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { socket } from '../socket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ---------- Cache ----------
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

class ChartCache {
  constructor() {
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.map.delete(key);
      return null;
    }
    return entry.data;
  }
  set(key, data) {
    if (!this.map.has(key) && this.map.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, { data, timestamp: Date.now() });
  }
  has(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.map.delete(key);
      return false;
    }
    return true;
  }
  clear() {
    this.map.clear();
  }
}

const chartCache = new ChartCache();

const buildFullPath = (ver, api) => {
  const base = ver.urlPath || api.path || '';
  const normalizedBase = base.startsWith('/') ? base : `/${base}`;
  return `/${ver.version}${normalizedBase}`;
};

// ---------- Memoized VersionItem ----------
const VersionItem = memo(
  ({ ver, api, projectId, isActive, onSelect, onHover }) => {
    const { theme } = useTheme();
    const isWhiteTheme = theme === 'white';

    const bgActive = isWhiteTheme
      ? 'bg-blue-100/40 text-blue-700 border-l-2 border-blue-500'
      : 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500';
    const bgInactive = isWhiteTheme
      ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40';

    return (
      <div
        className={`flex items-center gap-1 py-1.5 px-3 rounded cursor-pointer transition-all duration-150 ${
          isActive ? bgActive : bgInactive
        }`}
        onClick={() => onSelect(ver, projectId, api)}
        onMouseEnter={() => onHover(ver, projectId, api)}
        role="treeitem"
        tabIndex={0}
        aria-selected={isActive}
        aria-label={`${ver.label} ${ver.latency}ms`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(ver, projectId, api);
          }
        }}
      >
        <span className="text-xs" aria-hidden="true">🏷️</span>
        <span className="text-sm ml-1 font-medium">{ver.label}</span>
        <span className={`text-xs ml-auto ${isActive ? (isWhiteTheme ? 'text-blue-600' : 'text-blue-300') : 'text-zinc-500'}`}>
          {ver.latency}ms
        </span>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.ver.version === nextProps.ver.version &&
    prevProps.api.id === nextProps.api.id &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onHover === nextProps.onHover
);

VersionItem.displayName = 'VersionItem';

// ============================================================
// Main Dashboard Component
// ============================================================
function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('6h');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedApis, setExpandedApis] = useState({});

  const abortControllerRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const prefetchAbortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  // ---------- Cleanup ----------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (prefetchAbortControllerRef.current) prefetchAbortControllerRef.current.abort();
    };
  }, []);

  // ---------- Fetch projects (sidebar) ----------
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    fetch(`${API_BASE}/api/dashboard-data`, { credentials: 'include', signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!mountedRef.current) return;
        const projs = data.projects || [];
        setProjects(projs);

        const newExpProj = {};
        const newExpApi = {};
        projs.forEach(proj => {
          newExpProj[proj.id] = true;
          (proj.apis || []).forEach(api => {
            newExpApi[api.id] = true;
          });
        });
        setExpandedProjects(newExpProj);
        setExpandedApis(newExpApi);

        const firstProj = projs[0];
        const firstApi = firstProj?.apis?.[0];
        const firstVer = firstApi?.versions?.[0];
        if (firstProj && firstApi && firstVer) {
          const fullPath = buildFullPath(firstVer, firstApi);
          setSelectedVersion({
            projectId: firstProj.id,
            apiId: firstApi.id,
            path: fullPath,
            method: firstApi.method,
            version: firstVer.version,
            label: firstVer.label,
          });
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        if (mountedRef.current) setError(err.message);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // ---------- Fetch chart data ----------
  const fetchChartData = useCallback(async (
    projectId,
    path,
    method,
    range = timeRange,
    force = false
  ) => {
    const cacheKey = `stats:${projectId}:${path}:${method}:${range}`;

    if (!force && chartCache.has(cacheKey)) {
      const cached = chartCache.get(cacheKey);
      if (mountedRef.current) {
        setChartData(cached);
        setChartError(null);
        setChartLoading(false);
      }
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    if (mountedRef.current) {
      setChartLoading(true);
      setChartError(null);
    }

    try {
      const url = `${API_BASE}/api/latency-stats?project_id=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}&method=${method}&range=${range}`;
      const res = await fetch(url, { credentials: 'include', signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const points = data.points || [];

      if (mountedRef.current && !signal.aborted) {
        chartCache.set(cacheKey, points);
        setChartData(points);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (mountedRef.current) {
        setChartError(err.message || 'Failed to load chart data');
        setChartData([]);
      }
    } finally {
      if (mountedRef.current) {
        setChartLoading(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }
  }, [timeRange]);

  // ---------- Manual refresh ----------
  const refreshData = useCallback(() => {
    chartCache.clear();
    if (selectedVersion) {
      fetchChartData(
        selectedVersion.projectId,
        selectedVersion.path,
        selectedVersion.method,
        timeRange,
        true
      );
    }
  }, [selectedVersion, timeRange, fetchChartData]);

  // ---------- Load chart when selection changes ----------
  useEffect(() => {
    if (selectedVersion) {
      fetchChartData(
        selectedVersion.projectId,
        selectedVersion.path,
        selectedVersion.method,
        timeRange,
        true
      );
    }
  }, [selectedVersion, timeRange, fetchChartData]);

  // ---------- Auto‑refresh ----------
  useEffect(() => {
    if (autoRefresh && selectedVersion) {
      refreshIntervalRef.current = setInterval(() => {
        fetchChartData(
          selectedVersion.projectId,
          selectedVersion.path,
          selectedVersion.method,
          timeRange,
          true
        );
      }, 30000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefresh, selectedVersion, timeRange, fetchChartData]);

  // ---------- WebSocket listener ----------
  useEffect(() => {
    if (!socket) return;

    const onNewLog = (logData) => {
      if (!selectedVersion) return;
      const { project_id, path, method } = logData;
      if (
        project_id === selectedVersion.projectId &&
        path === selectedVersion.path &&
        method === selectedVersion.method
      ) {
        fetchChartData(
          selectedVersion.projectId,
          selectedVersion.path,
          selectedVersion.method,
          timeRange,
          true
        );
      }
    };

    socket.on('new_api_log', onNewLog);
    return () => {
      socket.off('new_api_log', onNewLog);
    };
  }, [socket, selectedVersion, timeRange, fetchChartData]);

  // ---------- Prefetch ----------
  const prefetchVersion = useCallback((ver, projId, api) => {
    const fullPath = buildFullPath(ver, api);
    const cacheKey = `stats:${projId}:${fullPath}:${api.method}:${timeRange}`;
    if (chartCache.has(cacheKey)) return;

    if (prefetchAbortControllerRef.current) {
      prefetchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    prefetchAbortControllerRef.current = controller;
    const { signal } = controller;

    const url = `${API_BASE}/api/latency-stats?project_id=${projId}&path=${encodeURIComponent(fullPath)}&method=${api.method}&range=${timeRange}`;
    fetch(url, { credentials: 'include', signal })
      .then(res => res.json())
      .then(data => {
        if (signal.aborted || !mountedRef.current) return;
        const points = data.points || [];
        if (!chartCache.has(cacheKey)) {
          chartCache.set(cacheKey, points);
        }
      })
      .catch(() => {});
  }, [timeRange]);

  // ---------- Version selection ----------
  const handleVersionSelect = useCallback((ver, projId, api) => {
    const fullPath = buildFullPath(ver, api);
    setSelectedVersion({
      projectId: projId,
      apiId: api.id,
      path: fullPath,
      method: api.method,
      version: ver.version,
      label: ver.label,
    });
  }, []);

  // ---------- Tree toggles ----------
  const toggleProject = useCallback((id) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleApi = useCallback((id) => {
    setExpandedApis(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ---------- Filter projects ----------
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const term = searchTerm.toLowerCase();
    return projects
      .map(proj => ({
        ...proj,
        apis: proj.apis?.filter(api =>
          api.path.toLowerCase().includes(term) ||
          api.versions?.some(v => v.label.toLowerCase().includes(term))
        )
      }))
      .filter(proj => proj.apis?.length > 0);
  }, [projects, searchTerm]);

  // ---------- Render tree ----------
  const renderTree = useMemo(() => {
    if (filteredProjects.length === 0) {
      return (
        <div className={`text-sm text-center py-8 px-4 ${isWhiteTheme ? 'text-gray-500' : 'text-zinc-500'}`}>
          {projects.length === 0
            ? 'No projects found. Import an OpenAPI spec to get started.'
            : 'No endpoints match your search.'}
        </div>
      );
    }

    const treeClasses = {
      project: `flex items-center gap-1 py-1 cursor-pointer hover:text-${isWhiteTheme ? 'gray-800' : 'white'} group`,
      projectIcon: `text-${isWhiteTheme ? 'gray-400' : 'zinc-500'} transition-transform duration-200`,
      projectName: `text-${isWhiteTheme ? 'gray-600' : 'zinc-400'} group-hover:text-${isWhiteTheme ? 'gray-800' : 'white'}`,
      projectCount: `text-xs ${isWhiteTheme ? 'text-gray-300' : 'text-zinc-600'} ml-auto`,
      api: `flex items-center gap-1 py-1 cursor-pointer hover:text-${isWhiteTheme ? 'gray-800' : 'white'} group`,
      apiName: `text-${isWhiteTheme ? 'gray-600' : 'zinc-400'} group-hover:text-${isWhiteTheme ? 'gray-800' : 'white'} text-sm`,
      apiCount: `text-xs ${isWhiteTheme ? 'text-gray-300' : 'text-zinc-600'} ml-auto`,
    };

    return filteredProjects.map(proj => {
      const isProjExpanded = expandedProjects[proj.id] !== false;
      return (
        <li key={proj.id} role="treeitem" className="select-none">
          <div
            className={treeClasses.project}
            onClick={() => toggleProject(proj.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleProject(proj.id);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={isProjExpanded}
            aria-label={`${proj.name} (${proj.apis?.length || 0} APIs)`}
          >
            <span className={`${treeClasses.projectIcon} ${isProjExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
              ▸
            </span>
            <span className={treeClasses.projectName}>📁 {proj.name}</span>
            <span className={treeClasses.projectCount}>{proj.apis?.length}</span>
          </div>

          {isProjExpanded && (
            <ul className={`ml-4 border-l ${isWhiteTheme ? 'border-gray-200' : 'border-zinc-800'} pl-2`} role="group">
              {proj.apis?.map(api => {
                const isApiExpanded = expandedApis[api.id] !== false;
                return (
                  <li key={api.id} role="treeitem">
                    <div
                      className={treeClasses.api}
                      onClick={() => toggleApi(api.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleApi(api.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isApiExpanded}
                      aria-label={`${api.method} ${api.path} (${api.versions?.length || 0} versions)`}
                    >
                      <span className={`${treeClasses.projectIcon} ${isApiExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
                        ▸
                      </span>
                      <span className={treeClasses.apiName}>
                        {api.method} {api.path}
                      </span>
                      <span className={treeClasses.apiCount}>{api.versions?.length}</span>
                    </div>

                    {isApiExpanded && (
                      <ul className={`ml-6 border-l ${isWhiteTheme ? 'border-gray-200' : 'border-zinc-800'} pl-2`} role="group">
                        {api.versions?.map(ver => {
                          const isActive =
                            selectedVersion?.version === ver.version &&
                            selectedVersion?.apiId === api.id &&
                            selectedVersion?.projectId === proj.id;
                          return (
                            <VersionItem
                              key={`${ver.version}-${api.id}`}
                              ver={ver}
                              api={api}
                              projectId={proj.id}
                              isActive={isActive}
                              onSelect={handleVersionSelect}
                              onHover={prefetchVersion}
                            />
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    });
  }, [
    filteredProjects,
    expandedProjects,
    expandedApis,
    selectedVersion,
    handleVersionSelect,
    prefetchVersion,
    projects.length,
    toggleProject,
    toggleApi,
    isWhiteTheme
  ]);

  // ---------- Chart render ----------
  const renderCharts = () => {
    if (chartLoading) {
      return (
        <div className="flex items-center justify-center h-48 text-zinc-500 animate-pulse">
          Loading data...
        </div>
      );
    }

    if (chartError) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-red-400">
          <div>⚠️ {chartError}</div>
          <button
            onClick={() =>
              selectedVersion &&
              fetchChartData(
                selectedVersion.projectId,
                selectedVersion.path,
                selectedVersion.method,
                timeRange,
                true
              )
            }
            className="mt-2 px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm transition"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!chartData.length) {
      return (
        <div className={`text-center py-8 ${isWhiteTheme ? 'text-gray-500' : 'text-zinc-500'}`}>
          No data available for this endpoint.<br />
          <span className={`text-xs ${isWhiteTheme ? 'text-gray-400' : 'text-zinc-600'}`}>
            Make a mock API call to start collecting statistics.
          </span>
          <button
            onClick={refreshData}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm transition"
          >
            🔄 Refresh Data
          </button>
        </div>
      );
    }

    const chartBg = isWhiteTheme ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800';
    const chartText = isWhiteTheme ? 'text-gray-500' : 'text-zinc-400';

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        <div className={`border rounded-xl p-4 ${chartBg}`}>
          <h3 className={`text-sm font-medium uppercase mb-2 ${chartText}`}>
            📈 Latency vs Requests
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isWhiteTheme ? '#e5e7eb' : '#3f3f46'} />
              <XAxis dataKey="time" tick={{ fill: isWhiteTheme ? '#6b7280' : '#a1a1aa' }} fontSize={10} />
              <YAxis yAxisId="left" stroke="#a78bfa" tick={{ fill: '#a78bfa' }} fontSize={10} />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#fbbf24"
                tick={{ fill: '#fbbf24' }}
                fontSize={10}
              />
              <Tooltip contentStyle={{ background: isWhiteTheme ? '#fff' : '#18181b', border: isWhiteTheme ? '1px solid #e5e7eb' : '1px solid #27272a' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="latency"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="requests"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={`border rounded-xl p-4 ${chartBg}`}>
          <h3 className={`text-sm font-medium uppercase mb-2 ${chartText}`}>
            📊 Requests over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isWhiteTheme ? '#e5e7eb' : '#3f3f46'} />
              <XAxis dataKey="time" tick={{ fill: isWhiteTheme ? '#6b7280' : '#a1a1aa' }} fontSize={10} />
              <YAxis stroke="#34d399" tick={{ fill: '#34d399' }} fontSize={10} />
              <Tooltip contentStyle={{ background: isWhiteTheme ? '#fff' : '#18181b', border: isWhiteTheme ? '1px solid #e5e7eb' : '1px solid #27272a' }} />
              <Bar dataKey="requests" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ---------- Main render ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-zinc-500">
        <span className="animate-pulse">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        Error: {error}
      </div>
    );
  }

  const currentProjectName = selectedVersion
    ? projects.find(p => p.id === selectedVersion.projectId)?.name || 'Project'
    : 'No Project';

  // ─── Theme-aware styles ──────────────────────────────────────────
  const bg = isWhiteTheme ? 'bg-gray-50' : 'bg-zinc-950';
  const text = isWhiteTheme ? 'text-gray-800' : 'text-zinc-300';
  const headerBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const borderColor = isWhiteTheme ? 'border-gray-200' : 'border-zinc-800';
  const sidebarBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const inputBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const inputBorder = isWhiteTheme ? 'border-gray-300' : 'border-zinc-800';
  const inputFocus = 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';
  const mutedText = isWhiteTheme ? 'text-gray-500' : 'text-zinc-500';
  const cardBg = isWhiteTheme ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800';

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${bg} ${text} transition-colors duration-200`}>
      {/* ========== HEADER ========== */}
      <header className={`h-12 shrink-0 flex items-center px-5 border-b ${headerBg} ${borderColor}`}>
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/setting')}
            className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
              isWhiteTheme ? 'text-gray-500 hover:text-gray-800' : 'text-zinc-400 hover:text-white'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded ${
              isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'
            }`}
            aria-label="Go to Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back</span>
          </button>
          <div className={`w-px h-5 ${isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-700'}`} />
          <span className={`text-sm font-semibold tracking-wide ${isWhiteTheme ? 'text-gray-700' : 'text-white'}`}>
            Dashboard
          </span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-4 text-sm">
          <span className={`${mutedText} font-medium`}>{currentProjectName}</span>
          <span className={`${isWhiteTheme ? 'text-gray-400' : 'text-zinc-600'}`}>
            {user?.username || 'Guest'}
          </span>
        </div>
      </header>

      {/* ========== BODY ========== */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className={`w-72 shrink-0 border-r flex flex-col ${sidebarBg} ${borderColor}`}>
          <div className={`px-4 py-3 border-b ${borderColor} text-xs font-semibold uppercase ${mutedText} flex justify-between items-center`}>
            <span className="flex items-center gap-2">
              <span>📂</span> Explorer
            </span>
            <button
              onClick={() => window.location.reload()}
              className={`${mutedText} hover:${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'} transition-colors`}
              aria-label="Reload dashboard"
            >
              ⟳
            </button>
          </div>
          <div className="p-3">
            <input
              type="text"
              placeholder="Search endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-200 border ${inputBg} ${inputBorder} ${inputFocus} ${isWhiteTheme ? 'text-gray-800 placeholder-gray-400' : 'text-zinc-300 placeholder-zinc-500'}`}
              aria-label="Search endpoints"
            />
          </div>
          <div className={`flex-1 overflow-y-auto px-2 py-2 custom-scrollbar ${isWhiteTheme ? 'scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300' : 'scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700'}`}>
            <ul className="space-y-1" role="tree">
              {renderTree}
            </ul>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <h1 className={`text-xl font-semibold truncate ${isWhiteTheme ? 'text-gray-800' : 'text-white'}`}>
              {selectedVersion
                ? `${selectedVersion.label} – ${selectedVersion.path || ''} (${selectedVersion.method})`
                : 'API Performance'}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={refreshData}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                🔄 Refresh
              </button>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className={`rounded-lg px-3 py-1.5 text-sm border outline-none transition-all ${inputBg} ${inputBorder} ${inputFocus} ${isWhiteTheme ? 'text-gray-800' : 'text-zinc-300'}`}
                aria-label="Select time range"
              >
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
              </select>
              <label className={`flex items-center gap-2 text-sm ${mutedText} cursor-pointer`}>
                <span aria-hidden="true">🔄</span>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh((prev) => !prev)}
                  className="w-4 h-4 accent-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                  aria-label="Toggle auto-refresh"
                />
                Auto-refresh
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {renderCharts()}
            <div className={`mt-4 text-xs ${mutedText} text-center border-t ${borderColor} pt-3`}>
              {autoRefresh && (
                <span className="text-blue-400 mr-2">⏳ Auto-refreshing every 30s •</span>
              )}
              {socket?.connected && (
                <span className="text-emerald-400 mr-2">⚡ Real‑time updates active</span>
              )}
              All timestamps in your local timezone
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
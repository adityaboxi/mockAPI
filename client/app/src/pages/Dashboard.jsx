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
import { apiClient } from '../services/apiClient';

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
  const [recentLogs, setRecentLogs] = useState([]);
  const [liveStats, setLiveStats] = useState({
    totalCalls: 0,
    avgLatency: 0,
    successCount: 0,
    errorCount: 0,
    lastCallTime: null,
  });

  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedApis, setExpandedApis] = useState({});

  const abortControllerRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const prefetchAbortControllerRef = useRef(null);
  const mountedRef = useRef(true);
  const seenLogKeysRef = useRef(new Set());

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

  // Safe timestamp parser
  const formatTime = useCallback((timeVal) => {
    if (!timeVal) return 'just now';
    try {
      let num = typeof timeVal === 'string' ? Number(timeVal) : timeVal;
      if (!isNaN(num) && typeof num === 'number' && num > 0) {
        if (num < 1e11) num = num * 1000;
        const d = new Date(num);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
      }
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      return 'just now';
    } catch {
      return 'just now';
    }
  }, []);

  // ---------- Fetch projects (sidebar) ----------
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    apiClient
      .get('/api/dashboard-data', { signal })
      .then((data) => {
        if (!mountedRef.current) return;
        const projs = data.projects || [];
        setProjects(projs);

        const newExpProj = {};
        const newExpApi = {};
        projs.forEach((proj) => {
          newExpProj[proj.id] = true;
          (proj.apis || []).forEach((api) => {
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
      .catch((err) => {
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
    force = false,
    silent = false
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

    if (mountedRef.current && !silent) {
      setChartLoading(true);
      setChartError(null);
    }

    try {
      const url = `/api/latency-stats?project_id=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}&method=${method}&range=${range}`;
      const data = await apiClient.get(url, { signal });
      const points = data.points || [];

      if (mountedRef.current && !signal.aborted) {
        chartCache.set(cacheKey, points);
        setChartData(points);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (mountedRef.current && !silent) {
        setChartError(err.message || 'Failed to load chart data');
        setChartData([]);
      }
    } finally {
      if (mountedRef.current) {
        if (!silent) setChartLoading(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }
  }, [timeRange]);

  // ---------- Fetch initial recent logs ----------
  useEffect(() => {
    if (!selectedVersion?.projectId) return;
    const controller = new AbortController();
    apiClient
      .get(`/api/recent-logs?project_id=${encodeURIComponent(selectedVersion.projectId)}`, {
        signal: controller.signal,
      })
      .then((data) => {
        if (!mountedRef.current) return;
        const fetched = data.logs || [];
        setRecentLogs(fetched);
        if (fetched.length > 0) {
          const total = fetched.length;
          const sumLat = fetched.reduce((acc, l) => acc + (Number(l.total_latency || l.latency_ms) || 0), 0);
          const succ = fetched.filter((l) => (Number(l.status || l.statusCode) || 200) < 400).length;
          setLiveStats({
            totalCalls: total,
            avgLatency: total > 0 ? Math.round(sumLat / total) : 0,
            successCount: succ,
            errorCount: Math.max(0, total - succ),
            lastCallTime: fetched[0]?.timestamp || null,
          });
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [selectedVersion?.projectId]);

  // ---------- Manual refresh ----------
  const refreshData = useCallback(() => {
    chartCache.clear();
    if (selectedVersion) {
      fetchChartData(
        selectedVersion.projectId,
        selectedVersion.path,
        selectedVersion.method,
        timeRange,
        true,
        false
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
        true,
        false
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
          true,
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

  // ---------- Real-Time WebSocket Telemetry Listener ----------
  useEffect(() => {
    if (!socket || !selectedVersion?.projectId) return;

    socket.emit('join_project', selectedVersion.projectId);

    const onNewLog = (logData) => {
      if (!mountedRef.current || !logData) return;
      const targetProj = logData.project_id || logData.projectId;
      if (targetProj && targetProj !== selectedVersion.projectId) return;

      let rawTime = logData.timestamp;
      let tsNum = typeof rawTime === 'number' ? rawTime : (rawTime ? new Date(rawTime).getTime() : Date.now());
      if (tsNum < 1e11) tsNum = tsNum * 1000;

      const uniqueKey = logData._id || `${targetProj}:${logData.method}:${logData.path || logData.url}:${tsNum}:${logData.latency_ms || logData.gateway_latency}`;

      if (seenLogKeysRef.current.has(uniqueKey)) {
        return;
      }
      seenLogKeysRef.current.add(uniqueKey);
      if (seenLogKeysRef.current.size > 500) {
        const firstKey = seenLogKeysRef.current.values().next().value;
        seenLogKeysRef.current.delete(firstKey);
      }

      const gatewayLatency = Number(logData.gateway_latency ?? logData.latency_ms) || 0;
      const teamLatency = Number(logData.team_latency) || 0;
      const latencyVal = Number(logData.total_latency) || (gatewayLatency + teamLatency);
      const statusVal = Number(logData.status ?? logData.statusCode) || 200;

      const normLog = {
        _id: uniqueKey,
        method: (logData.method || 'GET').toUpperCase(),
        path: logData.path || '/',
        status: statusVal,
        statusCode: statusVal,
        gateway_latency: gatewayLatency,
        team_latency: teamLatency,
        latency_ms: latencyVal,
        total_latency: latencyVal,
        timestamp: new Date(tsNum),
        ip: logData.ip || '127.0.0.1',
        cache: logData.cache || 'MISS',
      };

      setRecentLogs((prev) => [normLog, ...prev.slice(0, 49)]);

      setLiveStats((prev) => {
        const nextTotal = prev.totalCalls + 1;
        const nextAvg = Math.round((prev.avgLatency * prev.totalCalls + latencyVal) / nextTotal);
        const isSuccess = statusVal < 400;
        return {
          totalCalls: nextTotal,
          avgLatency: nextAvg,
          successCount: prev.successCount + (isSuccess ? 1 : 0),
          errorCount: prev.errorCount + (isSuccess ? 0 : 1),
          lastCallTime: normLog.timestamp,
        };
      });

      const selectedPathNorm = (selectedVersion.path || '').replace(/^\//, '');
      const incomingPathNorm = (logData.path || '').replace(/^\//, '');
      if (
        incomingPathNorm.endsWith(selectedPathNorm) ||
        selectedPathNorm.endsWith(incomingPathNorm) ||
        logData.path === selectedVersion.path
      ) {
        fetchChartData(
          selectedVersion.projectId,
          selectedVersion.path,
          selectedVersion.method,
          timeRange,
          true,
          true
        );
      }
    };

    socket.on('new_api_log', onNewLog);
    return () => {
      socket.off('new_api_log', onNewLog);
      socket.emit('leave_project', selectedVersion.projectId);
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

    const url = `/api/latency-stats?project_id=${projId}&path=${encodeURIComponent(fullPath)}&method=${api.method}&range=${timeRange}`;
    apiClient
      .get(url, { signal })
      .then((data) => {
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
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleApi = useCallback((id) => {
    setExpandedApis((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ---------- Filter projects ----------
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const term = searchTerm.toLowerCase();
    return projects
      .map((proj) => ({
        ...proj,
        apis: proj.apis?.filter((api) =>
          api.path.toLowerCase().includes(term) ||
          api.versions?.some((v) => v.label.toLowerCase().includes(term))
        ),
      }))
      .filter((proj) => proj.apis?.length > 0);
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

    return filteredProjects.map((proj) => {
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
              {proj.apis?.map((api) => {
                const isApiExpanded = expandedApis[api.id] !== false;
                return (
                  <li key={`${proj.id}-${api.id}`} role="treeitem">
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
                        {api.versions?.map((ver) => {
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
    isWhiteTheme,
  ]);

  // ---------- Chart render ----------
  const renderCharts = () => {
    if (chartLoading) {
      return (
        <div className="flex items-center justify-center h-48 text-zinc-500 animate-pulse">
          Loading telemetry data...
        </div>
      );
    }

    if (chartError) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-red-400">
          <div>⚠️ {chartError}</div>
          <button
            type="button"
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
          No data points recorded for this endpoint yet.<br />
          <span className={`text-xs ${isWhiteTheme ? 'text-gray-400' : 'text-zinc-600'}`}>
            Execute a request via the Studio Tester to populate real-time latency graphs.
          </span>
          <div className="mt-4">
            <button
              type="button"
              onClick={refreshData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm transition shadow-sm"
            >
              🔄 Refresh Data
            </button>
          </div>
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
              <Tooltip
                contentStyle={{
                  background: isWhiteTheme ? '#fff' : '#18181b',
                  border: isWhiteTheme ? '1px solid #e5e7eb' : '1px solid #27272a',
                  color: isWhiteTheme ? '#111827' : '#f4f4f5',
                }}
              />
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
              <Tooltip
                contentStyle={{
                  background: isWhiteTheme ? '#fff' : '#18181b',
                  border: isWhiteTheme ? '1px solid #e5e7eb' : '1px solid #27272a',
                  color: isWhiteTheme ? '#111827' : '#f4f4f5',
                }}
              />
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
    ? projects.find((p) => p.id === selectedVersion.projectId)?.name || 'Project'
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

  const methodColors = {
    GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    POST: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    PATCH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    DELETE: 'text-red-400 bg-red-500/10 border-red-500/30',
    OPTIONS: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  };

  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (status >= 300 && status < 400) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const successRatePercentage = liveStats.totalCalls > 0
    ? Math.round((liveStats.successCount / liveStats.totalCalls) * 100)
    : 100;

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${bg} ${text} transition-colors duration-200`}>
      {/* ========== HEADER ========== */}
      <header className={`h-[52px] shrink-0 flex items-center px-5 border-b ${headerBg} ${borderColor}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
              isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            aria-label="Go to Studio"
          >
            ← Studio
          </button>
          <button
            type="button"
            onClick={() => navigate('/tools')}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              isWhiteTheme ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
            aria-label="Go to Tools"
          >
            🛠️ Tools
          </button>
          <div className={`w-px h-4 ${isWhiteTheme ? 'bg-slate-200' : 'bg-zinc-800'}`} />
          <span className={`text-xs font-bold tracking-wider uppercase ${isWhiteTheme ? 'text-slate-800' : 'text-white'}`}>
            Live Telemetry Dashboard
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE GATEWAY
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
        <aside className={`w-72 shrink-0 border-r flex flex-col ${sidebarBg} ${borderColor}`}>
          <div className={`px-4 py-3 border-b ${borderColor} text-xs font-semibold uppercase ${mutedText} flex justify-between items-center`}>
            <span className="flex items-center gap-2">
              <span>📂</span> Explorer
            </span>
            <button
              type="button"
              onClick={refreshData}
              className={`${mutedText} hover:${isWhiteTheme ? 'text-gray-700' : 'text-zinc-300'} transition-colors`}
              aria-label="Refresh data"
              title="Refresh endpoints"
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
          <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
            <ul className="space-y-1" role="tree">
              {renderTree}
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 custom-scrollbar">
          {/* Header Controls */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
              <h1 className={`text-xl font-semibold truncate ${isWhiteTheme ? 'text-gray-800' : 'text-white'}`}>
                {selectedVersion
                  ? `${selectedVersion.label} – ${selectedVersion.path || ''} (${selectedVersion.method})`
                  : 'API Performance & Gateway Telemetry'}
              </h1>
              <p className={`text-xs ${mutedText} mt-0.5`}>
                Real-time OpenResty telemetry with non-blocking WebSocket stream
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={refreshData}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm"
              >
                🔄 Sync Now
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
              <label className={`flex items-center gap-2 text-sm ${mutedText} cursor-pointer select-none`}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh((prev) => !prev)}
                  className="w-4 h-4 accent-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                  aria-label="Toggle auto-refresh"
                />
                Auto-sync (30s)
              </label>
            </div>
          </div>

          {/* ========== 4 GOLDEN-RATIO LIVE TELEMETRY KPI CARDS ========== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* KPI 1: Total Calls */}
            <div className={`p-4 rounded-xl border ${cardBg} transition-all`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>Total Requests</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className={`text-2xl font-bold font-mono ${isWhiteTheme ? 'text-gray-900' : 'text-white'}`}>
                {liveStats.totalCalls}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <span>⚡ Real-time stream active</span>
              </div>
            </div>

            {/* KPI 2: Calculated Latency */}
            <div className={`p-4 rounded-xl border ${cardBg} transition-all`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>Calculated Latency</span>
                <span className="text-xs">⏱️</span>
              </div>
              <div className={`text-2xl font-bold font-mono ${isWhiteTheme ? 'text-gray-900' : 'text-white'}`}>
                {liveStats.avgLatency}<span className="text-sm font-normal ml-1">ms</span>
              </div>
              <div className="text-[11px] text-blue-400 mt-1 font-medium truncate" title="Gateway In/Out Processing Diff + Team Average Latency">
                <span>Gateway In/Out + Team Avg</span>
              </div>
            </div>

            {/* KPI 3: Success Rate */}
            <div className={`p-4 rounded-xl border ${cardBg} transition-all`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>Success Rate</span>
                <span className="text-xs">🛡️</span>
              </div>
              <div className={`text-2xl font-bold font-mono ${successRatePercentage >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {successRatePercentage}%
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {liveStats.successCount} ok / {liveStats.errorCount} err
              </div>
            </div>

            {/* KPI 4: Gateway State */}
            <div className={`p-4 rounded-xl border ${cardBg} transition-all`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={mutedText}>OpenResty Gateway</span>
                <span className="text-xs">🌐</span>
              </div>
              <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Connected :8080
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 truncate">
                {liveStats.lastCallTime ? `Last: ${formatTime(liveStats.lastCallTime)}` : 'Awaiting incoming calls...'}
              </div>
            </div>
          </div>

          {/* ========== CHARTS ========== */}
          <div className="mb-6">
            {renderCharts()}
          </div>

          {/* ========== LIVE REAL-TIME ACTIVITY FEED ========== */}
          <div className={`border rounded-xl p-4 ${cardBg} mb-4`}>
            <div className="flex items-center justify-between mb-3 border-b pb-2.5 border-inherit">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isWhiteTheme ? 'text-gray-800' : 'text-white'}`}>
                  📡 Live Real-Time Request Stream
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {recentLogs.length} recent calls
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                Capturing OpenResty requests live
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className={`text-center py-8 ${mutedText}`}>
                <p className="text-sm font-medium">No live requests captured yet.</p>
                <p className="text-xs mt-1">
                  Send a mock API request via the Studio Tester or <code className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs">curl</code> to see real-time streaming!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${borderColor} ${mutedText} uppercase font-semibold text-[10px]`}>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Path</th>
                      <th className="py-2 px-3">Latency</th>
                      <th className="py-2 px-3">Cache</th>
                      <th className="py-2 px-3">Client IP</th>
                      <th className="py-2 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit">
                    {recentLogs.map((log, index) => {
                      const methodClass = methodColors[log.method] || 'text-gray-400 bg-zinc-800/40 border-zinc-700';
                      const statusClass = getStatusBadge(log.status || log.statusCode || 200);
                      const timeStr = formatTime(log.timestamp || log.createdAt);

                      return (
                        <tr
                          key={log._id || log.id || `${log.timestamp}-${index}`}
                          className={`hover:${isWhiteTheme ? 'bg-gray-100/60' : 'bg-zinc-800/30'} transition-colors`}
                        >
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${statusClass}`}>
                              {log.status || log.statusCode || 200}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${methodClass}`}>
                              {log.method}
                            </span>
                          </td>
                          <td className={`py-2 px-3 font-mono font-medium ${isWhiteTheme ? 'text-gray-900' : 'text-zinc-200'}`}>
                            {log.path || '/'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-purple-400">
                              {log.total_latency || log.latency_ms || 0} ms
                            </span>
                            {(log.team_latency > 0 || log.gateway_latency > 0) && (
                              <span className="block text-[10px] text-zinc-500 font-mono">
                                {log.gateway_latency || log.latency_ms || 0}ms in/out {log.team_latency > 0 ? `+ ${log.team_latency}ms team` : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${log.cache === 'HIT' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500'}`}>
                              {log.cache || 'MISS'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-zinc-500 text-[11px]">
                            {log.ip || '127.0.0.1'}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                            {timeStr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className={`text-xs ${mutedText} text-center border-t ${borderColor} pt-3 mt-auto`}>
            {autoRefresh && (
              <span className="text-blue-400 mr-2">⏳ Auto-sync every 30s •</span>
            )}
            <span className="text-emerald-400 mr-2">⚡ Real‑time OpenResty WebSocket Stream Active</span>
            • All timestamps formatted in your local timezone
          </div>
        </main>
      </div>
    </div>
  );
}

export default React.memo(Dashboard);
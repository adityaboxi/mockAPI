// src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { socket } from '../socket'; // ✅ your Socket.IO client

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ---------- Cache with TTL and size limit ----------
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
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
    if (this.map.size >= MAX_CACHE_SIZE) {
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

// ---------- Memoized VersionItem ----------
const VersionItem = memo(
  ({ ver, api, projectId, isActive, onSelect, onHover }) => (
    <div
      className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition ${
        isActive ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'
      }`}
      onClick={() => onSelect(ver, projectId, api)}
      onMouseEnter={() => onHover(ver, projectId, api)}
      role="treeitem"
      tabIndex={0}
      aria-selected={isActive}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(ver, projectId, api);
        }
      }}
    >
      <span>🏷️</span>
      <span className="text-sm">{ver.label}</span>
      <span className="text-xs text-gray-600 ml-auto">{ver.latency}ms</span>
    </div>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.ver.version === nextProps.ver.version &&
      prevProps.api.id === nextProps.api.id &&
      prevProps.projectId === nextProps.projectId &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onHover === nextProps.onHover
    );
  }
);

VersionItem.displayName = 'VersionItem';

function Dashboard() {
  // ---------- State ----------
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

  const abortControllerRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // ---------- Cleanup ----------
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  // ---------- Fetch projects (sidebar) ----------
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    fetch(`${API_BASE}/api/dashboard-data`, { credentials: 'include', signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        return res.json();
      })
      .then(data => {
        setProjects(data.projects || []);
        const firstProj = data.projects?.[0];
        const firstApi = firstProj?.apis?.[0];
        const firstVer = firstApi?.versions?.[0];
        if (firstProj && firstApi && firstVer) {
          setSelectedVersion({
            projectId: firstProj.id,
            apiId: firstApi.id,
            path: firstApi.path,
            method: firstApi.method,
            version: firstVer.version,
            label: firstVer.label,
          });
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // ---------- Fetch chart data ----------
  const fetchChartData = useCallback(async (projectId, path, method, range = timeRange, force = false) => {
    const cacheKey = `stats:${projectId}:${path}:${method}:${range}`;
    if (!force && chartCache.has(cacheKey)) {
      setChartData(chartCache.get(cacheKey));
      setChartError(null);
      setChartLoading(false);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    setChartLoading(true);
    setChartError(null);

    try {
      const url = `${API_BASE}/api/latency-stats?project_id=${projectId}&path=${encodeURIComponent(path)}&method=${method}&range=${range}`;
      const res = await fetch(url, { credentials: 'include', signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const points = data.points || [];
      chartCache.set(cacheKey, points);
      setChartData(points);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setChartError(err.message || 'Failed to load chart data');
      setChartData([]);
    } finally {
      setChartLoading(false);
      abortControllerRef.current = null;
    }
  }, [timeRange]);

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

  // ---------- Auto‑refresh (REST polling) ----------
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

  // ---------- 🟢 WebSocket: real‑time new log listener ----------
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
        console.log('[Dashboard] New log – refreshing chart for', selectedVersion.path);
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

  // ---------- Prefetch on hover ----------
  const prefetchVersion = useCallback((ver, projId, api) => {
    const cacheKey = `stats:${projId}:${api.path}:${api.method}:${timeRange}`;
    if (!chartCache.has(cacheKey)) {
      const url = `${API_BASE}/api/latency-stats?project_id=${projId}&path=${encodeURIComponent(api.path)}&method=${api.method}&range=${timeRange}`;
      fetch(url, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const points = data.points || [];
          if (!chartCache.has(cacheKey)) chartCache.set(cacheKey, points);
        })
        .catch(() => {});
    }
  }, [timeRange]);

  // ---------- Version selection ----------
  const handleVersionSelect = useCallback((ver, projId, api) => {
    setSelectedVersion({
      projectId: projId,
      apiId: api.id,
      path: api.path,
      method: api.method,
      version: ver.version,
      label: ver.label,
    });
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
        <div className="text-gray-500 text-sm text-center py-8 px-4">
          {projects.length === 0
            ? 'No projects found. Import an OpenAPI spec to get started.'
            : 'No endpoints match your search.'}
        </div>
      );
    }

    return filteredProjects.map(proj => (
      <li key={proj.id} role="treeitem">
        <div className="flex items-center gap-1 text-gray-400 cursor-pointer hover:text-white py-1">
          <span>📁</span>
          <span>{proj.name}</span>
          <span className="text-xs text-gray-600 ml-auto">{proj.apis?.length}</span>
        </div>
        <ul className="ml-4" role="group">
          {proj.apis?.map(api => (
            <li key={api.id} role="treeitem">
              <div className="flex items-center gap-1 text-gray-400 cursor-pointer hover:text-white py-1">
                <span>📄</span>
                <span className="text-sm">{api.method} {api.path}</span>
                <span className="text-xs text-gray-600 ml-auto">{api.versions?.length}</span>
              </div>
              <ul className="ml-6" role="group">
                {api.versions?.map(ver => {
                  const isActive = selectedVersion?.version === ver.version &&
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
            </li>
          ))}
        </ul>
      </li>
    ));
  }, [filteredProjects, selectedVersion, handleVersionSelect, prefetchVersion, projects.length]);

  // ---------- Charts ----------
  const renderCharts = () => {
    if (chartLoading) {
      return <div className="flex items-center justify-center h-48 text-gray-500 animate-pulse">Loading data...</div>;
    }

    if (chartError) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-red-400">
          <div>⚠️ {chartError}</div>
          <button
            onClick={() => selectedVersion && fetchChartData(
              selectedVersion.projectId,
              selectedVersion.path,
              selectedVersion.method,
              timeRange,
              true
            )}
            className="mt-2 px-4 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-sm transition"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!chartData.length) {
      return <div className="text-gray-500 text-center py-8">No data available for this endpoint</div>;
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        <div className="bg-[#2b2d31] border border-[#3f4147] rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">📈 Latency vs Requests</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f4147" />
              <XAxis dataKey="time" tick={{ fill: '#888' }} fontSize={10} />
              <YAxis yAxisId="left" stroke="#a78bfa" tick={{ fill: '#a78bfa' }} fontSize={10} />
              <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" tick={{ fill: '#fbbf24' }} fontSize={10} />
              <Tooltip contentStyle={{ background: '#1e1e24', border: '1px solid #3f4147' }} />
              <Line yAxisId="left" type="monotone" dataKey="latency" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="requests" stroke="#fbbf24" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#2b2d31] border border-[#3f4147] rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">📊 Requests over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f4147" />
              <XAxis dataKey="time" tick={{ fill: '#888' }} fontSize={10} />
              <YAxis stroke="#34d399" tick={{ fill: '#34d399' }} fontSize={10} />
              <Tooltip contentStyle={{ background: '#1e1e24', border: '1px solid #3f4147' }} />
              <Bar dataKey="requests" fill="#34d399" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
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

  return (
    <div className="flex h-screen bg-[#1e1e24] text-gray-200 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-[#25252b] border-r border-[#3f4147] flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-[#3f4147] text-xs font-semibold text-gray-500 uppercase flex justify-between">
          <span>📂 Explorer</span>
          <button onClick={() => window.location.reload()} className="text-gray-600 hover:text-gray-300">⟳</button>
        </div>
        <div className="p-3">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e1e24] border border-[#3f4147] rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
            aria-label="Search endpoints"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="space-y-1" role="tree">{renderTree}</ul>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h1 className="text-xl font-medium truncate">
            {selectedVersion
              ? `${selectedVersion.label} – ${selectedVersion.path || ''} (${selectedVersion.method})`
              : 'API Performance'}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-[#2b2d31] border border-[#3f4147] rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
              aria-label="Select time range"
            >
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <span>🔄</span>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(prev => !prev)}
                className="w-4 h-4 accent-indigo-500"
              />
              Auto-refresh
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {renderCharts()}
          <div className="mt-4 text-xs text-gray-600 text-center border-t border-[#2a2a30] pt-3">
            {autoRefresh && <span className="text-indigo-400 mr-2">⏳ Auto-refreshing every 30s •</span>}
            {socket?.connected && <span className="text-emerald-400 mr-2">⚡ Real‑time updates active</span>}
            All timestamps in your local timezone
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
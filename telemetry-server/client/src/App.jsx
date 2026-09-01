import React, { useState, useEffect, useCallback } from 'react';
import { useLogs } from './hooks/useLogs';
import { useSocketIO } from './hooks/useSocketIO';
import { useNetwork } from './hooks/useNetwork';
import TopologyGraph from './components/TopologyGraph';
import LogPanel from './components/LogPanel';
import NodeDetails from './components/NodeDetails';
import TitleUpdater from './components/TitleUpdater';
import './styles/index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3003';

function isValidJwt(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false; // Expired
    }
    return true;
  } catch (_) {
    return false;
  }
}

function App() {
  const [jwtToken, setJwtToken] = useState(() => {
    try {
      const saved = localStorage.getItem('telemetry_jwt_token');
      return isValidJwt(saved) ? saved : null;
    } catch (_) {
      return null;
    }
  });

  const [isAuth, setIsAuth] = useState(() => {
    try {
      const saved = localStorage.getItem('telemetry_jwt_token');
      return isValidJwt(saved);
    } catch (_) {
      return false;
    }
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const { logs, metricsMap, addLog, updateMetrics, getMetricsForNode, getLogsForNode, errorLogsForNode, completedLogsForNode, stats } = useLogs();
  const { nodes, edges } = useNetwork(logs);
  const [selectedNode, setSelectedNode] = useState(null);
  const [edgeHoverLogs, setEdgeHoverLogs] = useState([]);
  const [edgeHoverData, setEdgeHoverData] = useState(null);

  const { isConnected } = useSocketIO(
    WS_URL,
    isAuth,
    jwtToken,
    (log) => addLog(log),
    (trace) => console.log('Trace received', trace),
    (metrics) => updateMetrics(metrics)
  );

  // ─── Fetch initial logs and metrics after auth ──────────────────────────
  useEffect(() => {
    if (!isAuth || !jwtToken) return;
    const authHeaders = { 'Authorization': `Bearer ${jwtToken}` };

    fetch(`${API_BASE}/logs?limit=100`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : { logs: [] })
      .then((data) => {
        if (data.logs) data.logs.forEach((log) => addLog(log));
      })
      .catch((err) => console.error('[App] Failed to load logs:', err));

    fetch(`${API_BASE}/metrics`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : { metrics: [] })
      .then((data) => {
        if (data.metrics) updateMetrics(data.metrics);
      })
      .catch((err) => console.error('[App] Failed to load metrics:', err));
  }, [isAuth, jwtToken, addLog, updateMetrics]);

  // ─── Validate JWT Token on Load / Refresh ────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('telemetry_jwt_token');
    if (!saved || !isValidJwt(saved)) {
      setIsAuth(false);
      setJwtToken(null);
      return;
    }

    fetch(`${API_BASE}/check-auth`, {
      headers: { 'Authorization': `Bearer ${saved}` },
    })
      .then((res) => {
        if (res.status === 401) {
          // Token rejected by server
          localStorage.removeItem('telemetry_jwt_token');
          setIsAuth(false);
          setJwtToken(null);
        } else if (res.ok) {
          setIsAuth(true);
          setJwtToken(saved);
        }
      })
      .catch(() => {
        // Network offline / momentary hiccup: trust valid local JWT
        if (isValidJwt(saved)) {
          setIsAuth(true);
          setJwtToken(saved);
        }
      });
  }, []);

  // ─── Login handler ──────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          try {
            localStorage.setItem('telemetry_jwt_token', data.token);
          } catch (_) {}
          setJwtToken(data.token);
          setIsAuth(true);
          setUsername('');
          setPassword('');
        }
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Login failed');
      }
    } catch {
      setLoginError('Network error connecting to telemetry server');
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('telemetry_jwt_token');
    } catch (_) {}
    await fetch(`${API_BASE}/logout`, { method: 'POST' }).catch(() => {});
    setIsAuth(false);
    setJwtToken(null);
    setSelectedNode(null);
  };

  const handleNodeClick = useCallback((nodeId) => {
    setSelectedNode(nodeId);
  }, []);

  const handleEdgeHover = useCallback((edgeLogs, edge) => {
    setEdgeHoverLogs(edgeLogs || []);
    setEdgeHoverData(edge);
  }, []);

  if (!isAuth) {
    return (
      <>
        <TitleUpdater />
        <div className="min-h-screen flex items-center justify-center bg-[#1e1e2e]">
          <div className="w-full max-w-sm p-6 bg-[#181825] rounded-xl border border-[#313244]">
            <div className="text-center mb-6">
              <img src="/logo.svg" alt="Logo" className="block mx-auto w-8 h-8 mb-1" />
              <h1 className="text-lg font-mono font-semibold text-[#89b4fa]">telemetry</h1>
              <p className="text-[#6c7086] text-xs font-mono mt-0.5">sign in to monitor your services</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-[#1e1e2e] border border-[#313244] rounded text-[#cdd6f4] text-sm font-mono placeholder-[#6c7086] outline-none focus:ring-1 focus:ring-[#89b4fa]"
                required
              />
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1e1e2e] border border-[#313244] rounded text-[#cdd6f4] text-sm font-mono placeholder-[#6c7086] outline-none focus:ring-1 focus:ring-[#89b4fa]"
                required
              />
              <button
                type="submit"
                className="w-full py-2 bg-[#89b4fa] hover:bg-[#74c7ec] text-[#1e1e2e] font-mono font-semibold rounded transition"
              >
                sign in
              </button>
              {loginError && (
                <div className="text-[#f38ba8] text-xs font-mono text-center">{loginError}</div>
              )}
            </form>
          </div>
        </div>
      </>
    );
  }

  const isLive = isConnected;

  return (
    <>
      <TitleUpdater />
      <div className="h-screen flex flex-col bg-[#1e1e2e] text-[#cdd6f4] font-mono">
        <header className="flex items-center justify-between px-4 py-2 border-b border-[#313244] shrink-0 bg-[#181825]/50">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="w-6 h-6" />
            <h1 className="text-sm font-semibold text-[#89b4fa]">topology</h1>
            <div className="flex items-center gap-1.5 text-[10px] text-[#6c7086]">
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#a6da95]' : 'bg-[#f38ba8]'}`} />
              <span>{isLive ? 'live' : 'offline'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[#6c7086]">
            <span>events: <span className="text-[#cdd6f4]">{stats.total}</span></span>
            <span>errors: <span className="text-[#f38ba8]">{stats.errors}</span></span>
            <button onClick={handleLogout} className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] rounded text-[10px] font-mono transition">
              logout
            </button>
          </div>
        </header>

        <div className="flex-1 flex gap-3 p-3 min-h-0">
          <div className="flex-1 min-w-0">
            <TopologyGraph
              nodes={nodes}
              edges={edges}
              logs={logs}
              metricsMap={metricsMap}
              onNodeClick={handleNodeClick}
              onEdgeHover={handleEdgeHover}
            />
          </div>
          <div className="w-[360px] shrink-0 min-h-0">
            {selectedNode ? (
              <NodeDetails
                nodeId={selectedNode}
                metrics={getMetricsForNode(selectedNode)}
                logs={getLogsForNode(selectedNode)}
                errorLogs={errorLogsForNode(selectedNode)}
                completedLogs={completedLogsForNode(selectedNode)}
                onClose={() => setSelectedNode(null)}
              />
            ) : edgeHoverData ? (
              <LogPanel
                logs={edgeHoverLogs}
                title={`🔗 ${edgeHoverData.from} → ${edgeHoverData.to}`}
              />
            ) : (
              <LogPanel logs={logs} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;


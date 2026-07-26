import React, { useState, useEffect, useCallback } from 'react';
import { useLogs } from './hooks/useLogs';
import { useSocketIO } from './hooks/useSocketIO';
import { useNetwork } from './hooks/useNetwork';
import TopologyGraph from './components/TopologyGraph';
import LogPanel from './components/LogPanel';
import NodeDetails from './components/NodeDetails';
import './styles/index.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3003';

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [jwtToken, setJwtToken] = useState(null);

  const { logs, addLog, getLogsForNode, errorLogsForNode, completedLogsForNode, stats } = useLogs();
  const { nodes, edges } = useNetwork(logs);
  const [selectedNode, setSelectedNode] = useState(null);
  const [edgeHoverLogs, setEdgeHoverLogs] = useState([]);
  const [edgeHoverData, setEdgeHoverData] = useState(null);

  // Socket.IO connection (token optional – server falls back to session cookie)
  const { isConnected } = useSocketIO(
    WS_URL,
    isAuth,                    // enabled only when authenticated
    jwtToken,                  // may be null
    (log) => addLog(log),
    (trace) => console.log('Trace received', trace)
  );

  // ─── Fetch initial logs after auth ──────────────────────────
  useEffect(() => {
    if (!isAuth) return;

    // Use the session cookie (credentials: 'include') – no need for Bearer token if cookie works.
    // If you have a token, you can still include it, but we'll rely on the cookie.
    fetch(`${API_BASE}/logs?limit=100`, {
      credentials: 'include',
      // Optionally include Authorization header if token exists
      ...(jwtToken && { headers: { 'Authorization': `Bearer ${jwtToken}` } }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.logs) data.logs.forEach((log) => addLog(log));
      })
      .catch((err) => console.error('[App] Failed to load logs:', err));
  }, [isAuth, jwtToken]);

  // ─── Check auth status on load ──────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/check-auth`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setIsAuth(data.authenticated);
        if (data.authenticated) {
          // If you want to store the JWT from the session (if returned), you could.
        }
      })
      .catch(() => setIsAuth(false));
  }, []);

  // ─── Login handler ──────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) setJwtToken(data.token); // store token if returned
        setIsAuth(true);
        setUsername('');
        setPassword('');
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Login failed');
      }
    } catch {
      setLoginError('Network error');
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
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
      <div className="min-h-screen flex items-center justify-center bg-[#1e1e2e]">
        <div className="w-full max-w-sm p-6 bg-[#181825] rounded-xl border border-[#313244]">
          <div className="text-center mb-6">
            <div className="text-3xl mb-1">🔐</div>
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
    );
  }

  const isLive = isConnected;

  return (
    <div className="h-screen flex flex-col bg-[#1e1e2e] text-[#cdd6f4] font-mono">
      <header className="flex items-center justify-between px-4 py-2 border-b border-[#313244] shrink-0 bg-[#181825]/50">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[#89b4fa]">🌐 topology</h1>
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
            onNodeClick={handleNodeClick}
            onEdgeHover={handleEdgeHover}
          />
        </div>
        <div className="w-[360px] shrink-0 min-h-0">
          {selectedNode ? (
            <NodeDetails
              nodeId={selectedNode}
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
  );
}

export default App;


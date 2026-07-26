import React, { useState, useMemo, useRef, useEffect } from 'react';

function LogPanel({ logs, title = '📋 Live Logs', onClear }) {
  const [levelFilter, setLevelFilter] = useState('');
  const [limit, setLimit] = useState(20);
  const listRef = useRef(null);

  // Auto‑scroll to bottom when logs change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs]);

  const filtered = useMemo(() => {
    let result = levelFilter ? logs.filter((l) => l.level === levelFilter) : logs;
    return result.slice(0, limit);
  }, [logs, levelFilter, limit]);

  const levelBadge = (level) => {
    const map = {
      INFO: 'bg-blue/20 text-blue',
      WARN: 'bg-yellow/20 text-yellow',
      ERROR: 'bg-red/20 text-red',
      FATAL: 'bg-red/30 text-red',
    };
    return map[level] || 'bg-surface3 text-textMuted';
  };

  // Format time (HH:MM:SS)
  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Invalid time';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] rounded-xl border border-[#313244] overflow-hidden">
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#313244] shrink-0">
        <span className="text-[10px] font-mono font-medium text-[#6c7086] uppercase tracking-wider">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-[#181825] border border-[#313244] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#cdd6f4] outline-none focus:ring-1 focus:ring-[#89b4fa]"
          >
            <option value="">All</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warn</option>
            <option value="ERROR">Error</option>
            <option value="FATAL">Fatal</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-[#181825] border border-[#313244] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#cdd6f4] outline-none focus:ring-1 focus:ring-[#89b4fa]"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[#6c7086] hover:text-[#f38ba8] text-[10px] font-mono transition-colors px-1"
              aria-label="Clear logs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── Log List ──────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6c7086] text-xs font-mono">
            No logs to display
          </div>
        ) : (
          filtered.map((log, i) => {
            // Use a stable key if available
            const key = log.id || log._id || `log-${i}`;
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-2 py-1 rounded bg-[#181825]/50 hover:bg-[#313244]/30 transition-colors text-[11px] font-mono"
              >
                <span className="text-[#6c7086] shrink-0">
                  {formatTime(log.timestamp)}
                </span>
                <span
                  className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${levelBadge(log.level || 'INFO')}`}
                >
                  {log.level || 'INFO'}
                </span>
                <span className="flex-1 truncate text-[#cdd6f4]">{log.message || ''}</span>
                <span className="text-[#6c7086] text-[9px] shrink-0">
                  {log.container || '-'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Footer ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#313244] text-[9px] text-[#6c7086] font-mono shrink-0">
        <span>total: {logs.length}</span>
        <span>
          errors: {logs.filter((l) => l.level === 'ERROR' || l.level === 'FATAL').length}
        </span>
      </div>
    </div>
  );
}

export default LogPanel;
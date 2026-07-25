import React, { useState, useMemo } from 'react';

function LogPanel({ logs, title = '📋 Live Logs' }) {
  const [levelFilter, setLevelFilter] = useState('');
  const [limit, setLimit] = useState(20);

  const filtered = useMemo(() => {
    let result = levelFilter ? logs.filter((l) => l.level === levelFilter) : logs;
    return result.slice(0, limit);
  }, [logs, levelFilter, limit]);

  const levelBadge = (level) => {
    const map = {
      INFO: 'bg-[#89b4fa]/20 text-[#89b4fa]',
      WARN: 'bg-[#f9e2af]/20 text-[#f9e2af]',
      ERROR: 'bg-[#f38ba8]/20 text-[#f38ba8]',
      FATAL: 'bg-[#f38ba8]/30 text-[#f38ba8]',
    };
    return map[level] || 'bg-[#313244] text-[#6c7086]';
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] rounded-xl border border-[#313244] overflow-hidden">
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6c7086] text-xs font-mono">
            No logs to display
          </div>
        ) : (
          filtered.map((log, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded bg-[#181825]/50 hover:bg-[#313244]/30 transition-colors text-[11px] font-mono"
            >
              <span className="text-[#6c7086] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${levelBadge(
                  log.level || 'INFO'
                )}`}
              >
                {log.level || 'INFO'}
              </span>
              <span className="flex-1 truncate text-[#cdd6f4]">{log.message || ''}</span>
              <span className="text-[#6c7086] text-[9px] shrink-0">
                {log.container || '-'}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#313244] text-[9px] text-[#6c7086] font-mono shrink-0">
        <span>total: {logs.length}</span>
        <span>errors: {logs.filter((l) => l.level === 'ERROR' || l.level === 'FATAL').length}</span>
      </div>
    </div>
  );
}

export default LogPanel;
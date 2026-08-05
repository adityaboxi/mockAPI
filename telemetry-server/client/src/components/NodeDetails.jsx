import React, { useState, useMemo, useRef, useCallback } from 'react';

function NodeDetails({ nodeId, logs = [], errorLogs = [], completedLogs = [], onClose }) {
  const [levelFilter, setLevelFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(50);
  const listRef = useRef(null);

  const total = logs.length;
  const errors = errorLogs.length;
  const completed = completedLogs.length;
  const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
  const status = errors > 0 ? 'error' : total > 0 ? 'healthy' : 'idle';
  const statusColor = status === 'error' ? '#f38ba8' : status === 'healthy' ? '#a6da95' : '#6c7086';

  const filtered = useMemo(() => {
    let result = logs;
    if (levelFilter) {
      result = result.filter((l) => l.level === levelFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (l) =>
          (l.message && l.message.toLowerCase().includes(term)) ||
          (l.container && l.container.toLowerCase().includes(term))
      );
    }
    return result.slice(0, limit);
  }, [logs, levelFilter, searchTerm, limit]);

  const copyLog = (log) => {
    const text = `[${log.timestamp}] ${log.level}: ${log.message} (${log.container || '-'})`;
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const formatTime = (timestamp) => {
    try {
      const diff = Date.now() - new Date(timestamp).getTime();
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return 'Invalid time';
    }
  };

  const fullTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Invalid time';
    }
  };

  const levelBadge = (level) => {
    const map = {
      INFO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      WARN: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      ERROR: 'bg-red-500/20 text-red-300 border-red-500/30',
      FATAL: 'bg-rose-500/30 text-rose-300 border-rose-500/40',
    };
    return map[level] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] rounded-xl border border-[#2a2a4a] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a4a] bg-[#16162a] shrink-0">
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-[13px] font-mono font-semibold text-[#cdd6f4]">
            📦 {nodeId}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#89b4fa]/20 text-[#89b4fa] font-mono">
            {total} logs
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#6c7086] hover:text-[#cdd6f4] transition-colors text-sm leading-none font-mono"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-[#2a2a4a] bg-[#1e1e3a]/30">
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#cdd6f4]">{total}</div>
          <div className="text-[9px] text-[#6c7086] uppercase tracking-wider font-mono">total</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#f38ba8]">{errors}</div>
          <div className="text-[9px] text-[#6c7086] uppercase tracking-wider font-mono">errors</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#a6da95]">{completed}</div>
          <div className="text-[9px] text-[#6c7086] uppercase tracking-wider font-mono">completed</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#89b4fa]">{successRate}%</div>
          <div className="text-[9px] text-[#6c7086] uppercase tracking-wider font-mono">success rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2a2a4a] bg-[#16162a] shrink-0 flex-wrap">
        <input
          type="text"
          placeholder="Search logs…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[120px] px-2.5 py-1 bg-[#1e1e3a] border border-[#2a2a4a] rounded-md text-[11px] font-mono text-[#cdd6f4] placeholder-[#6c7086] outline-none focus:ring-1 focus:ring-[#89b4fa] transition"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-md px-2 py-1 text-[10px] font-mono text-[#cdd6f4] outline-none focus:ring-1 focus:ring-[#89b4fa] transition"
        >
          <option value="">All levels</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warn</option>
          <option value="ERROR">Error</option>
          <option value="FATAL">Fatal</option>
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-md px-2 py-1 text-[10px] font-mono text-[#cdd6f4] outline-none focus:ring-1 focus:ring-[#89b4fa] transition"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>

      {/* Log list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6c7086] text-xs font-mono">
            {searchTerm || levelFilter ? 'No matching logs' : 'No logs available'}
          </div>
        ) : (
          filtered.map((log, i) => {
            const key = log.id || log._id || `log-${i}`;
            return (
              <div
                key={key}
                className="group flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-[#1e1e3a]/40 hover:bg-[#2a2a4a]/60 border-l-2 border-transparent hover:border-[#89b4fa]/40 transition-all duration-150"
              >
                <time
                  dateTime={log.timestamp}
                  title={fullTime(log.timestamp)}
                  className="text-[10px] font-mono text-[#6c7086] shrink-0 min-w-[60px]"
                >
                  {formatTime(log.timestamp)}
                </time>
                <span
                  className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase border ${levelBadge(
                    log.level || 'INFO'
                  )} shrink-0`}
                >
                  {log.level || 'INFO'}
                </span>
                <span className="flex-1 text-[11px] font-mono text-[#cdd6f4] break-all">
                  {log.message || ''}
                </span>
                <span className="text-[9px] font-mono text-[#6c7086] shrink-0">
                  {log.container || '-'}
                </span>
                <button
                  onClick={() => copyLog(log)}
                  className="opacity-0 group-hover:opacity-100 text-[#6c7086] hover:text-[#89b4fa] transition"
                  aria-label="Copy log"
                  title="Copy log line"
                >
                  📋
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default NodeDetails;


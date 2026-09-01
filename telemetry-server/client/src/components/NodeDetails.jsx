import React, { useState, useMemo, useRef } from 'react';
import { NODE_DEFS } from '../hooks/diagramData';

function NodeDetails({ nodeId, metrics, logs = [], errorLogs = [], completedLogs = [], onClose }) {
  const [levelFilter, setLevelFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(50);
  const listRef = useRef(null);

  const nodeMeta = NODE_DEFS[nodeId] || {
    label: nodeId,
    group: 'container',
    description: 'Dynamic Container Instance',
  };

  const isExternal = nodeMeta.group === 'domain' || nodeMeta.group === 'external' || nodeMeta.group === 'gateway';

  const total = metrics?.totalRequests || logs.length;
  const errors = metrics?.failedRequests || errorLogs.length;
  const completed = metrics?.completedRequests || completedLogs.length;
  const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
  
  const cpuPercent = metrics?.cpuPercent ?? 0;
  const memoryMb = metrics?.memoryMb ?? 0;
  const memoryLimitMb = metrics?.memoryLimitMb ?? 512;
  const memoryPercent = metrics?.memoryPercent ?? 0;
  const throughputRps = metrics?.throughputRps ?? (total > 0 ? Math.max(1, Math.round((total / 60) * 10) / 10) : 0);
  const avgLatency = metrics?.avgLatencyMs ?? (logs[0]?.latency || 24);

  const status = errors > 0 ? 'error' : total > 0 ? 'healthy' : isExternal ? 'external' : 'idle';
  const statusColor = status === 'error' ? '#f38ba8' : status === 'healthy' ? '#a6da95' : status === 'external' ? '#89b4fa' : '#6c7086';

  // Error breakdown analysis
  const errorBreakdown = useMemo(() => {
    const counts = { '5xx Server Error': 0, '4xx Client Error': 0, 'Timeout / Network': 0, 'Other': 0 };
    errorLogs.forEach((l) => {
      const code = l.statusCode || l.status;
      if (code >= 500) counts['5xx Server Error']++;
      else if (code >= 400) counts['4xx Client Error']++;
      else if (l.message?.toLowerCase().includes('timeout') || l.message?.toLowerCase().includes('econnrefused')) counts['Timeout / Network']++;
      else counts['Other']++;
    });
    return counts;
  }, [errorLogs]);

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
    <div className="flex flex-col h-full bg-[#181825] rounded-xl border border-[#313244] shadow-2xl overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-start justify-between p-3.5 border-b border-[#313244] bg-[#11111b]/80 shrink-0">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
            />
            <h2 className="text-xs font-bold text-[#cdd6f4] truncate">
              {nodeMeta.label || nodeId}
            </h2>
            <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#313244] text-[#89b4fa] shrink-0">
              {nodeMeta.group || 'service'}
            </span>
          </div>
          <p className="text-[10px] text-[#a6adc8] truncate">
            {nodeMeta.description}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[#6c7086] hover:text-[#cdd6f4] transition text-sm p-1 leading-none hover:bg-[#313244] rounded"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      {/* External Service / Domain Endpoint Card vs Real-time Container Stats */}
      {isExternal ? (
        <div className="p-3 border-b border-[#313244] bg-[#1e1e2e]/50 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#89b4fa] flex items-center gap-1.5 font-semibold">
              🌐 External Endpoint / Managed Service
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#313244] text-[#a6da95]">
              Cloud Native
            </span>
          </div>
          <p className="text-[10px] text-[#a6adc8] leading-relaxed">
            {nodeMeta.group === 'domain'
              ? 'Public Ingress Domain Route forwarding traffic to the cluster edge proxy.'
              : nodeMeta.group === 'gateway'
              ? 'Edge CDN, SSL Termination, & Ingress Reverse Proxy Layer.'
              : 'Managed Cloud Provider API (Not a local container instance).'}
          </p>
        </div>
      ) : (
        <div className="p-3 border-b border-[#313244] bg-[#1e1e2e]/50 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#a6adc8] flex items-center gap-1.5 font-semibold">
              ⚡ CPU Usage
            </span>
            <span className={`font-bold ${cpuPercent > 80 ? 'text-[#f38ba8]' : cpuPercent > 50 ? 'text-[#f9e2af]' : 'text-[#a6da95]'}`}>
              {cpuPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#11111b] rounded-full overflow-hidden border border-[#313244]/50">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${cpuPercent}%`,
                backgroundColor: cpuPercent > 80 ? '#f38ba8' : cpuPercent > 50 ? '#f9e2af' : '#a6da95',
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] pt-1">
            <span className="text-[#a6adc8] flex items-center gap-1.5 font-semibold">
              🧠 RAM Memory
            </span>
            <span className={`font-bold ${memoryPercent > 80 ? 'text-[#f38ba8]' : 'text-[#89b4fa]'}`}>
              {memoryMb} MB <span className="text-[#6c7086]">({memoryPercent}%)</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#11111b] rounded-full overflow-hidden border border-[#313244]/50">
            <div
              className="h-full bg-[#89b4fa] rounded-full transition-all duration-500"
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Traffic & Request Analytics Row */}
      <div className="grid grid-cols-4 gap-1 p-2.5 border-b border-[#313244] bg-[#1e1e2e]/30 shrink-0">
        <div className="text-center p-1 rounded bg-[#181825]/80 border border-[#313244]/50">
          <div className="text-xs font-bold text-[#cdd6f4]">{total}</div>
          <div className="text-[8px] text-[#6c7086] uppercase">requests</div>
        </div>
        <div className="text-center p-1 rounded bg-[#181825]/80 border border-[#313244]/50">
          <div className="text-xs font-bold text-[#f38ba8]">{errors}</div>
          <div className="text-[8px] text-[#6c7086] uppercase">failed</div>
        </div>
        <div className="text-center p-1 rounded bg-[#181825]/80 border border-[#313244]/50">
          <div className="text-xs font-bold text-[#a6da95]">{throughputRps}</div>
          <div className="text-[8px] text-[#6c7086] uppercase">req/sec</div>
        </div>
        <div className="text-center p-1 rounded bg-[#181825]/80 border border-[#313244]/50">
          <div className="text-xs font-bold text-[#89b4fa]">{avgLatency}ms</div>
          <div className="text-[8px] text-[#6c7086] uppercase">latency</div>
        </div>
      </div>

      {/* Error Root Cause Diagnostic Breakdown (If errors exist) */}
      {errors > 0 && (
        <div className="p-2.5 border-b border-[#313244] bg-[#f38ba8]/5 shrink-0 space-y-1.5">
          <div className="text-[10px] font-bold text-[#f38ba8] uppercase tracking-wider flex items-center gap-1">
            ⚠️ Failure Breakdown ({errors} failed)
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            {Object.entries(errorBreakdown).map(([type, count]) => count > 0 && (
              <div key={type} className="flex items-center justify-between px-2 py-1 bg-[#181825]/80 border border-[#f38ba8]/30 rounded">
                <span className="text-[#cdd6f4] truncate">{type}</span>
                <span className="font-bold text-[#f38ba8] ml-1">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-1.5 p-2 border-b border-[#313244] bg-[#11111b]/50 shrink-0">
        <input
          type="text"
          placeholder="Filter node logs…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-2 py-1 bg-[#1e1e2e] border border-[#313244] rounded text-[10px] text-[#cdd6f4] placeholder-[#6c7086] outline-none focus:ring-1 focus:ring-[#89b4fa]"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="bg-[#1e1e2e] border border-[#313244] rounded px-1.5 py-1 text-[9px] text-[#cdd6f4] outline-none"
        >
          <option value="">ALL</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="bg-[#1e1e2e] border border-[#313244] rounded px-1.5 py-1 text-[9px] text-[#cdd6f4] outline-none"
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* Live Log Stream Feed */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#6c7086] text-[11px] gap-1">
            <span>{searchTerm || levelFilter ? 'No matching logs' : 'No logs recorded for this node'}</span>
            <span className="text-[9px] text-[#45475a]">Stream listening on Socket.IO</span>
          </div>
        ) : (
          filtered.map((log, i) => (
            <div
              key={log.id || `node-log-${i}`}
              className="group flex items-start gap-1.5 p-1.5 rounded bg-[#1e1e2e]/40 hover:bg-[#313244]/50 border-l-2 border-transparent hover:border-[#89b4fa] transition text-[10px]"
            >
              <time className="text-[9px] text-[#6c7086] shrink-0 min-w-[50px]">
                {formatTime(log.timestamp)}
              </time>
              <span className={`px-1 py-0.2 rounded text-[8px] font-bold border ${levelBadge(log.level || 'INFO')} shrink-0`}>
                {log.level || 'INFO'}
              </span>
              <span className="flex-1 text-[#cdd6f4] break-all leading-tight">
                {log.message || ''}
              </span>
              <button
                onClick={() => copyLog(log)}
                className="opacity-0 group-hover:opacity-100 text-[#6c7086] hover:text-[#89b4fa] transition"
                title="Copy log"
              >
                📋
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NodeDetails;



import React from 'react';

function NodeDetails({ nodeId, logs, errorLogs, completedLogs, onClose }) {
  const errors = errorLogs || [];
  const completed = completedLogs || [];

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] rounded-xl border border-[#313244] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#313244] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-[#cdd6f4]">📦 {nodeId}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#89b4fa]/20 text-[#89b4fa] font-mono">
            {logs.length} logs
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#6c7086] hover:text-[#cdd6f4] transition-colors text-sm leading-none font-mono"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-[#313244]">
        <div className="bg-[#181825] rounded-lg px-2 py-1.5 text-center">
          <div className="text-xl font-bold font-mono text-[#f38ba8]">{errors.length}</div>
          <div className="text-[9px] text-[#6c7086] uppercase tracking-wider font-mono">failed</div>
        </div>
        <div className="bg-[#181825] rounded-lg px-2 py-1.5 text-center">
          <div className="text-xl font-bold font-mono text-[#a6da95]">{completed.length}</div>
          <div className="text-[9px] text-[#6c7086] uppercase tracking-wider font-mono">completed</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-semibold text-[#f38ba8] uppercase tracking-wider">
              ❌ failed
            </span>
            <span className="text-[9px] text-[#6c7086] font-mono">{errors.length}</span>
          </div>
          {errors.length === 0 ? (
            <p className="text-[10px] text-[#6c7086] italic font-mono">No failed logs</p>
          ) : (
            <div className="space-y-0.5">
              {errors.map((log, i) => (
                <div
                  key={i}
                  className="bg-[#f38ba8]/5 border-l-2 border-[#f38ba8] rounded px-2 py-1 text-[10px] font-mono"
                >
                  <span className="text-[#6c7086]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="ml-2 text-[#cdd6f4]">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-semibold text-[#a6da95] uppercase tracking-wider">
              ✅ completed
            </span>
            <span className="text-[9px] text-[#6c7086] font-mono">{completed.length}</span>
          </div>
          {completed.length === 0 ? (
            <p className="text-[10px] text-[#6c7086] italic font-mono">No completed logs</p>
          ) : (
            <div className="space-y-0.5">
              {completed.map((log, i) => (
                <div
                  key={i}
                  className="bg-[#a6da95]/5 border-l-2 border-[#a6da95] rounded px-2 py-1 text-[10px] font-mono"
                >
                  <span className="text-[#6c7086]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="ml-2 text-[#cdd6f4]">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NodeDetails;
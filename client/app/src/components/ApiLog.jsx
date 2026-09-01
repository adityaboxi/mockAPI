// src/components/ApiLog.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";
import { useSocket } from "../context/SocketContext";

// Color mapping for HTTP methods
const methodColor = {
  GET: "text-emerald-400",
  POST: "text-blue-400",
  PUT: "text-amber-400",
  PATCH: "text-orange-400",
  DELETE: "text-rose-400",
  OPTIONS: "text-purple-400",
  SYSTEM: "text-gray-400",
};

function ApiLog() {
  const { theme } = useTheme();
  const { currentProject } = useProject();
  const socket = useSocket();

  const isWhiteTheme = theme === "white";
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(() => socket?.connected || false);
  const [socketError, setSocketError] = useState(null);
  const mountedRef = useRef(true);
  const projectId = currentProject?.id;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLogs([]);
      setIsConnected(false);
      setSocketError(null);
      return;
    }

    if (!socket) return;

    const onConnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setSocketError(null);
      }
      socket.emit("join_project", projectId);
    };

    const onConnectError = () => {
      if (mountedRef.current) {
        setIsConnected(false);
        setSocketError("Connection failed. Retrying...");
      }
    };

    const onDisconnect = () => {
      if (mountedRef.current) setIsConnected(false);
    };

    const onInitialLogs = (dbLogs) => {
      if (mountedRef.current) setLogs(Array.isArray(dbLogs) ? dbLogs : []);
    };

    let flushTimer = null;
    const logBuffer = [];

    const flushBuffer = () => {
      if (!mountedRef.current || logBuffer.length === 0) return;
      const incoming = [...logBuffer];
      logBuffer.length = 0;
      setLogs((prev) => {
        const idSet = new Set(prev.map((l) => l._id || l.id));
        const filteredIncoming = incoming.filter((l) => !idSet.has(l._id || l.id));
        return [...filteredIncoming.reverse(), ...prev].slice(0, 100);
      });
    };

    const onNewApiLog = (newLog) => {
      if (!newLog || !mountedRef.current) return;
      const logProjId = newLog.projectId || newLog.project_id;
      if (logProjId && logProjId !== projectId) return;
      logBuffer.push(newLog);
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flushBuffer();
        }, 60);
      }
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.on("initial_logs", onInitialLogs);
    socket.on("new_api_log", onNewApiLog);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      if (socket) {
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
        socket.off("disconnect", onDisconnect);
        socket.off("initial_logs", onInitialLogs);
        socket.off("new_api_log", onNewApiLog);
        if (projectId) socket.emit("leave_project", projectId);
      }
    };
  }, [projectId, socket]);

  const formatDate = useCallback((dateVal) => {
    if (!dateVal) return "Just now";
    try {
      let num = typeof dateVal === "string" ? Number(dateVal) : dateVal;
      if (!isNaN(num) && typeof num === "number" && num > 0) {
        if (num < 1e11) num = num * 1000;
        const d = new Date(num);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
      }
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
      return "Just now";
    } catch {
      return "Just now";
    }
  }, []);

  const getStatusBadgeClass = (status) => {
    const code = Number(status) || 200;
    if (code >= 200 && code < 300) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (code >= 400 && code < 500) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    if (code >= 500) return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    return "text-zinc-400 bg-zinc-800 border-zinc-700";
  };

  // Theme-aware styles
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const bgHeader = isWhiteTheme ? "bg-white/80" : "bg-zinc-900/80";
  const textHeader = isWhiteTheme ? "text-gray-700" : "text-zinc-300";
  const bgLogEntry = isWhiteTheme
    ? "bg-white border-gray-200 hover:bg-gray-50"
    : "bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/60";
  const textMuted = isWhiteTheme ? "text-gray-400" : "text-zinc-500";
  const badgeBg = isWhiteTheme ? "bg-gray-200 text-gray-700" : "bg-zinc-700 text-zinc-300";

  return (
    <div
      className={`
        w-56 flex flex-col shrink-0 border-l h-full
        ${isWhiteTheme ? "bg-gray-50/50" : "bg-zinc-950/50"}
        ${borderColor}
      `}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-2.5 border-b shrink-0 select-none
          ${bgHeader} ${borderColor} ${textHeader}
        `}
      >
        <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-2">
          <span aria-hidden="true">📋</span> Logs
        </span>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${badgeBg}`}>
              {logs.length}
            </span>
          )}
          {!isConnected && projectId && (
            <span className="text-[10px] text-rose-400 animate-pulse">● offline</span>
          )}
          {isConnected && projectId && (
            <span className="text-[10px] text-emerald-400">● live</span>
          )}
        </div>
      </div>

      {/* Logs container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 custom-scrollbar">
        {socketError && (
          <div className="text-center text-rose-400 italic text-xs py-4">{socketError}</div>
        )}
        {!socketError && !isConnected && projectId && (
          <div className="text-center text-amber-400 italic text-xs py-4">Connecting…</div>
        )}
        {isConnected && logs.length === 0 && (
          <div className={`text-center ${textMuted} italic text-xs py-4`}>
            No logs yet. Create or test an API to stream telemetry.
          </div>
        )}
        {logs.map((log, index) => {
          const logKey = log._id || log.id || `${log.timestamp || log.createdAt || index}-${index}`;
          const statusNum = log.statusCode || log.status || 200;
          const logUser = log.username ? `@${log.username}` : "client";
          const logTime = formatDate(log.createdAt || log.timestamp);

          return (
            <div
              key={logKey}
              className={`
                rounded-lg border p-3 transition-all duration-200 shadow-xs
                ${bgLogEntry} ${borderColor}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs font-mono font-bold truncate ${methodColor[log.method] || "text-gray-400"}`}>
                  {log.method || "GET"}
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${getStatusBadgeClass(statusNum)}`}>
                  {statusNum}
                </span>
              </div>
              <p className="text-xs font-mono mt-1 break-all text-current font-medium">
                {log.url || log.path || "/"}
              </p>
              <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-zinc-500 font-mono">
                {log.total_latency || log.latency_ms ? (
                  <span className="text-purple-400 font-semibold">⚡ {log.total_latency || log.latency_ms} ms</span>
                ) : null}
                <span>↳ {logUser}</span>
                <span>↳ {logTime}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(ApiLog);
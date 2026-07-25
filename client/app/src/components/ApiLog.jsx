import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

// Color mapping for HTTP methods – kept as is
const methodColor = {
  GET: "text-green-400",
  POST: "text-blue-400",
  PUT: "text-yellow-400",
  PATCH: "text-orange-400",
  DELETE: "text-red-400",
  OPTIONS: "text-purple-400",
  SYSTEM: "text-gray-400",
};

function ApiLog() {
  const { theme } = useTheme();
  const { currentProject } = useProject();
  const { user } = useAuth();
  const socket = useSocket();

  const isWhiteTheme = theme === "white";
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const mountedRef = useRef(true);
  const projectId = currentProject?.id;

  // Track component mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Socket event handlers – unchanged logic
  useEffect(() => {
    if (!projectId) {
      setLogs([]);
      setIsConnected(false);
      setSocketError(null);
      return;
    }

    const onConnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setSocketError(null);
      }
      socket.emit("join_project", projectId);
    };

    const onConnectError = (err) => {
      if (mountedRef.current) {
        setIsConnected(false);
        setSocketError("Connection failed. Retrying...");
      }
    };

    const onDisconnect = (reason) => {
      if (mountedRef.current) setIsConnected(false);
    };

    const onInitialLogs = (dbLogs) => {
      if (mountedRef.current) setLogs(dbLogs || []);
    };

    const onNewApiLog = (newLog) => {
      if (!newLog || !mountedRef.current) return;
      setLogs((prev) => {
        const exists = prev.some((log) => log._id === newLog._id);
        if (exists) return prev;
        return [newLog, ...prev].slice(0, 100);
      });
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
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("initial_logs", onInitialLogs);
      socket.off("new_api_log", onNewApiLog);
      if (projectId) socket.emit("leave_project", projectId);
    };
  }, [projectId]);

  // Format timestamp – unchanged
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid date";
    }
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
          flex items-center justify-between px-4 py-2.5 border-b shrink-0
          ${bgHeader} ${borderColor} ${textHeader}
        `}
      >
        <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-2">
          <span>📋</span> Logs
        </span>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${badgeBg}`}>
              {logs.length}
            </span>
          )}
          {!isConnected && projectId && (
            <span className="text-[10px] text-red-400 animate-pulse">● offline</span>
          )}
          {isConnected && projectId && (
            <span className="text-[10px] text-green-400">● live</span>
          )}
        </div>
      </div>

      {/* Logs container */}
      <div
        className={`
          flex-1 overflow-y-auto p-3 space-y-2 min-h-0
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          ${isWhiteTheme
            ? "[&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400"
            : "[&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
          }
        `}
      >
        {socketError && (
          <div className="text-center text-red-400 italic text-xs py-4">{socketError}</div>
        )}
        {!socketError && !isConnected && projectId && (
          <div className="text-center text-yellow-400 italic text-xs py-4">Connecting…</div>
        )}
        {isConnected && logs.length === 0 && (
          <div className={`text-center ${textMuted} italic text-xs py-4`}>
            No logs yet. Create or update an API to see activity.
          </div>
        )}
        {logs.map((log) => (
          <div
            key={log._id}
            className={`
              rounded-lg border p-3 transition-all duration-200
              ${bgLogEntry} ${borderColor}
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`text-xs font-mono font-semibold truncate ${methodColor[log.method] || "text-gray-400"}`}>
                {log.method}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[60%]">
                {log.version && `v${log.version}`}
              </span>
            </div>
            <p className="text-xs font-mono mt-1 break-words text-current">
              {log.url}
            </p>
            <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-zinc-400">
              <span>↳ {log.action}</span>
              <span>↳ {log.username}</span>
              <span>↳ {formatDate(log.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApiLog;
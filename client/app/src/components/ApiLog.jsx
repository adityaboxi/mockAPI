/*import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

// Color mapping for HTTP methods
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

  // Socket event handlers
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
      console.log("[ApiLog] New log received:", newLog);
      if (!newLog || !mountedRef.current) return;
      setLogs((prev) => {
        const exists = prev.some((log) => log._id === newLog._id);
        if (exists) return prev;
        return [newLog, ...prev].slice(0, 100); // Keep only last 100 logs
      });
    };

    // Attach event listeners
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.on("initial_logs", onInitialLogs);
    socket.on("new_api_log", onNewApiLog);

    // If socket already connected, join project immediately
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

  // Format timestamp for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  // Conditional styles based on theme
  const cardClass = isWhiteTheme
    ? "bg-gray-50 border-gray-200 text-gray-500"
    : "bg-[#1e1f22] border-zinc-700/50 text-gray-400";

  return (
    <div
      className={`w-40 flex flex-col shrink-0 border-l h-full ${
        isWhiteTheme ? "border-gray-200" : "border-zinc-700/50"
      }`}
    >
  
      <div
        className={`text-xs font-medium border-b p-2 flex justify-between items-center shrink-0 ${
          isWhiteTheme
            ? "bg-gray-50 border-gray-200 text-gray-600"
            : "bg-[#232428] border-zinc-700/50 text-gray-300"
        }`}
      >
        <span>Action Logs</span>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span
              className={`text-[10px] rounded px-1.5 py-0.5 ${
                isWhiteTheme
                  ? "bg-gray-200 text-gray-700"
                  : "bg-zinc-700 text-zinc-300"
              }`}
            >
              {logs.length}
            </span>
          )}
          {!isConnected && projectId && (
            <span className="text-[10px] text-red-400">⚠️ offline</span>
          )}
        </div>
      </div>

   
      <div className="p-3 text-xs flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
        {socketError && (
          <p className="text-center text-red-400 italic">{socketError}</p>
        )}
        {!socketError && !isConnected && projectId && (
          <p className="text-center text-yellow-400 italic">Connecting…</p>
        )}
        {isConnected && logs.length === 0 && (
          <p className="text-center text-zinc-500 mt-4 italic">
            No logs yet. Create or update an API to see activity.
          </p>
        )}
        {logs.map((log) => (
          <div key={log._id} className={`border rounded p-3 w-full ${cardClass}`}>
            <p
              className={`font-medium mb-1 break-words ${
                methodColor[log.method] || "text-gray-400"
              }`}
            >
              {log.method} {log.url}
            </p>
            <p className="ml-2 text-zinc-500">↳ {log.action}</p>
            {log.version && (
              <p className="ml-2 text-zinc-500">↳ version {log.version}</p>
            )}
            <p className="ml-2 text-zinc-500">↳ {formatDate(log.createdAt)}</p>
            <p className="ml-2 text-zinc-500">↳ by {log.username}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApiLog;*/




import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";
import { useSocket } from "../context/SocketContext";

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
  const socket = useSocket();
  const isWhiteTheme = theme === "white";
  const projectId = currentProject?.id;

  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);

  // Socket event handlers
  useEffect(() => {
    if (!projectId) {
      setLogs([]);
      setIsConnected(false);
      setSocketError(null);
      return;
    }

    const onConnect = () => {
      setIsConnected(true);
      setSocketError(null);
      socket.emit("join_project", projectId);
    };

    const onConnectError = () => {
      setIsConnected(false);
      setSocketError("Connection failed. Retrying...");
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onInitialLogs = (dbLogs) => {
      setLogs(dbLogs || []);
    };

    const onNewApiLog = (newLog) => {
      if (!newLog) return;
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
  }, [projectId, socket]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
  };

  const cardClass = isWhiteTheme
    ? "bg-gray-50 border-gray-200 text-gray-500"
    : "bg-[#1e1f22] border-zinc-700/50 text-gray-400";

  return (
    <div
      className={`w-40 flex flex-col shrink-0 border-l h-full ${
        isWhiteTheme ? "border-gray-200" : "border-zinc-700/50"
      }`}
    >
      <div
        className={`text-xs font-medium border-b p-2 flex justify-between items-center shrink-0 ${
          isWhiteTheme
            ? "bg-gray-50 border-gray-200 text-gray-600"
            : "bg-[#232428] border-zinc-700/50 text-gray-300"
        }`}
      >
        <span>Action Logs</span>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span
              className={`text-[10px] rounded px-1.5 py-0.5 ${
                isWhiteTheme
                  ? "bg-gray-200 text-gray-700"
                  : "bg-zinc-700 text-zinc-300"
              }`}
            >
              {logs.length}
            </span>
          )}
          {!isConnected && projectId && (
            <span className="text-[10px] text-red-400">⚠️ offline</span>
          )}
        </div>
      </div>

      <div className="p-3 text-xs flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
        {socketError && (
          <p className="text-center text-red-400 italic">{socketError}</p>
        )}
        {!socketError && !isConnected && projectId && (
          <p className="text-center text-yellow-400 italic">Connecting…</p>
        )}
        {isConnected && logs.length === 0 && (
          <p className="text-center text-zinc-500 mt-4 italic">
            No logs yet. Create or update an API to see activity.
          </p>
        )}
        {logs.map((log) => (
          <div key={log._id} className={`border rounded p-3 w-full ${cardClass}`}>
            <p
              className={`font-medium mb-1 break-words ${
                methodColor[log.method] || "text-gray-400"
              }`}
            >
              {log.method} {log.url}
            </p>
            <p className="ml-2 text-zinc-500">↳ {log.action}</p>
            {log.version && (
              <p className="ml-2 text-zinc-500">↳ version {log.version}</p>
            )}
            <p className="ml-2 text-zinc-500">↳ {formatDate(log.createdAt)}</p>
            <p className="ml-2 text-zinc-500">↳ by {log.username}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApiLog;
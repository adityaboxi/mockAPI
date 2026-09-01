// src/components/ApiHistory.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useApiVersion } from "../context/ApiVersionContext";
import { useSocket } from "../context/SocketContext";
import { apiClient } from "../services/apiClient";

const INITIAL_SHOW = 3;

function ApiHistory({ isApiHistoryOpen, projectId: propProjectId }) {
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { currentVersionData, loadVersion } = useApiVersion();
  const socket = useSocket();

  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const historyDataRef = useRef(historyData);
  useEffect(() => {
    historyDataRef.current = historyData;
  }, [historyData]);

  const projectId = propProjectId || currentProject?.id;

  const fetchHistory = useCallback(async (silent = false) => {
    const username = user?.username;
    if (!projectId) {
      setHistoryData([]);
      return;
    }
    if (!username || username === "Guest") {
      setError("Please log in to see API history.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!silent && historyDataRef.current.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const baseUrl = import.meta.env.VITE_API_URL_API_HISTORY || '/api/api-history';
      const url = `${baseUrl}?projectId=${encodeURIComponent(projectId)}`;
      let data = await apiClient.get(url, { signal: controller.signal, skipCache: true });

      if (Array.isArray(data) && data.length && !data[0].versions && data[0].actualFullUrls) {
        data = data.map((ep) => ({
          baseUrlPath: ep.baseUrlPath,
          versions: ep.actualFullUrls.map((u, idx) => ({
            version: `v${idx + 1}`,
            fullUrl: u,
            method: "GET",
          })),
        }));
      }

      if (!controller.signal.aborted) {
        setHistoryData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to load version history");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [projectId, user?.username]);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchHistory]);

  // Local synchronous event listener for instant UI history refresh
  useEffect(() => {
    const onLocalHistoryUpdate = () => {
      fetchHistory(true);
    };
    window.addEventListener('mockapi:history_updated', onLocalHistoryUpdate);
    return () => window.removeEventListener('mockapi:history_updated', onLocalHistoryUpdate);
  }, [fetchHistory]);

  // Socket listener for real-time collaborator version creation
  useEffect(() => {
    if (!projectId || !socket) return;

    const handleUpdate = (data) => {
      if (data && (data.action === 'call' || data.type === 'call' || data.latency_ms !== undefined || data.statusCode !== undefined)) {
        return;
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchHistory(true);
      }, 150);
    };

    const events = [
      "api_history_update",
      "api_created",
      "api_updated",
      "api_deleted",
      "version_created",
      "version_updated",
      "version_deleted",
      "project_status_changed",
    ];

    events.forEach((evt) => socket.on(evt, handleUpdate));
    socket.emit("join_project", projectId);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (socket) {
        events.forEach((evt) => socket.off(evt, handleUpdate));
        socket.emit("leave_project", projectId);
      }
    };
  }, [projectId, fetchHistory, socket]);

  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleVersionClick = async (endpoint, version) => {
    const username = user?.username;
    if (!username) return;
    const baseurlpath = endpoint.baseUrlPath;
    if (!baseurlpath) return;
    const pid = projectId || currentProject?.id;
    if (!pid) return;
    await loadVersion(pid, username, baseurlpath, version);
  };

  // ─── THEME‑AWARE STYLES ─────────────────────────────────────────
  const sidebarBg = isWhiteTheme ? "bg-slate-50/50" : "bg-[#0c0c0e]/50";
  const borderColor = isWhiteTheme ? "border-slate-200/80" : "border-zinc-800/60";
  const headerBg = isWhiteTheme ? "bg-white/60" : "bg-zinc-900/40";
  const headerText = isWhiteTheme ? "text-slate-700" : "text-zinc-300";
  const cardBg = isWhiteTheme
    ? "bg-white border-slate-200/80 hover:border-slate-300"
    : "bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700/80";
  const textMuted = isWhiteTheme ? "text-slate-400" : "text-zinc-500";
  const pathText = isWhiteTheme ? "text-blue-600" : "text-blue-400";
  const versionBtnBase = isWhiteTheme
    ? "text-slate-600 hover:bg-blue-50 hover:text-blue-600"
    : "text-zinc-400 hover:bg-blue-600/10 hover:text-blue-400";
  const versionBtnActive = isWhiteTheme
    ? "bg-blue-100/70 text-blue-700 font-bold border-l-2 border-blue-500"
    : "bg-blue-500/20 text-blue-300 font-bold border-l-2 border-blue-400";

  return (
    <aside className={`flex shrink-0 overflow-hidden z-10 ${sidebarBg} border-l ${borderColor}`}>
      <div
        className={`
          flex flex-col overflow-hidden transition-all duration-300 ease-in-out
          ${isApiHistoryOpen ? "w-64" : "w-0"}
          ${borderColor}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 select-none ${headerBg} ${borderColor} ${headerText}`}>
          <span className="text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5">
            <span aria-hidden="true">📜</span> History
          </span>
          {historyData.length > 0 && !loading && (
            <span className={`text-[10px] font-mono rounded-full px-2 py-0.2 font-semibold ${
              isWhiteTheme ? "bg-slate-200 text-slate-700" : "bg-zinc-800 text-zinc-300"
            }`}>
              {historyData.reduce((acc, ep) => acc + (ep.versions?.length || 0), 0)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 custom-scrollbar">
          {loading && historyData.length === 0 && (
            <div className="flex justify-center py-6">
              <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isWhiteTheme ? "border-gray-300 border-t-gray-600" : "border-zinc-700 border-t-blue-400"}`} />
            </div>
          )}
          {error && <div className="text-center text-rose-400 text-xs py-4">{error}</div>}
          {!loading && !error && historyData.length === 0 && (
            <div className={`text-center ${textMuted} italic text-xs py-4`}>
              No API history found for this workspace.
            </div>
          )}
          {historyData.map((endpoint, idx) => {
            const versions = endpoint.versions || [];
            const isExpanded = expanded[endpoint.baseUrlPath || idx];
            const visibleVersions = isExpanded ? versions : versions.slice(0, INITIAL_SHOW);
            const totalVersions = versions.length;
            const remaining = totalVersions - INITIAL_SHOW;

            return (
              <div
                key={endpoint.baseUrlPath || idx}
                className={`rounded-lg border p-3 transition-all duration-200 shadow-xs ${cardBg} ${borderColor}`}
              >
                {/* Endpoint path */}
                <p className={`text-xs font-mono font-semibold break-all ${pathText}`}>
                  {endpoint.baseUrlPath || "unknown"}
                </p>

                {/* Version list */}
                <div className="mt-1.5 space-y-0.5">
                  {visibleVersions.map((v, vIdx) => {
                    const isCurrentActive =
                      currentVersionData?.version === v.version &&
                      (currentVersionData?.urlPath === endpoint.baseUrlPath ||
                        currentVersionData?.urlPath === `/${endpoint.baseUrlPath}`);

                    return (
                      <button
                        key={v.version || vIdx}
                        type="button"
                        onClick={() => handleVersionClick(endpoint, v.version)}
                        className={`
                          block w-full text-left px-2 py-1 rounded text-xs font-mono
                          transition-all duration-150
                          ${isCurrentActive ? versionBtnActive : versionBtnBase}
                        `}
                      >
                        <span className="opacity-50 mr-1">↳</span> {v.version}
                      </button>
                    );
                  })}
                </div>

                {/* Expand/Collapse controls */}
                {!isExpanded && remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(endpoint.baseUrlPath || idx)}
                    className="mt-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline transition-all flex items-center gap-1 focus:outline-none"
                  >
                    + {remaining} more version{remaining > 1 ? 's' : ''}
                  </button>
                )}
                {isExpanded && totalVersions > INITIAL_SHOW && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(endpoint.baseUrlPath || idx)}
                    className="mt-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:underline transition-all flex items-center gap-1 focus:outline-none"
                  >
                    − show less
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default React.memo(ApiHistory);
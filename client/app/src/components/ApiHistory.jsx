import React, { useState, useEffect, useRef, useCallback } from "react";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useApiVersion } from "../context/ApiVersionContext";
import { useSocket } from "../context/SocketContext";

const INITIAL_SHOW = 2;

function ApiHistory({ isApiHistoryOpen, projectId: propProjectId }) {
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { loadVersion } = useApiVersion();
  const socket = useSocket();

  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const abortControllerRef = useRef(null);

  const historyDataRef = useRef(historyData);
  useEffect(() => {
    historyDataRef.current = historyData;
  }, [historyData]);

  const projectId = propProjectId || currentProject?.id;

  const fetchHistory = useCallback(async () => {
    const username = user?.username;
    if (!projectId) return;
    if (!username || username === "Guest") {
      setError("Please log in to see API history.");
      return;
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_API_URL_API_HISTORY}?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url, { signal: controller.signal, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      let data = await res.json();
      if (data.length && !data[0].versions && data[0].actualFullUrls) {
        data = data.map(ep => ({
          baseUrlPath: ep.baseUrlPath,
          versions: ep.actualFullUrls.map((url, idx) => ({
            version: `v${idx + 1}`,
            fullUrl: url
          }))
        }));
      }

      const currentData = historyDataRef.current;
      if (JSON.stringify(data) === JSON.stringify(currentData)) {
        if (!controller.signal.aborted) setLoading(false);
        return;
      }
      if (!controller.signal.aborted) setHistoryData(data);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [projectId, user?.username]);

  useEffect(() => {
    fetchHistory();
    return () => abortControllerRef.current?.abort();
  }, [fetchHistory]);

  useEffect(() => {
    if (!currentProject?.id) return;

    const handleNewLog = () => fetchHistory();
    socket.on("new_api_log", handleNewLog);
    socket.emit("join_project", currentProject.id);

    return () => {
      socket.emit("leave_project", currentProject.id);
      socket.off("new_api_log", handleNewLog);
    };
  }, [currentProject?.id, fetchHistory, socket]);

  const toggleExpand = (idx) => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));

  const handleVersionClick = async (endpoint, version, fullUrl) => {
    const username = user?.username;
    if (!username) return;
    const baseurlpath = endpoint.baseUrlPath;
    if (!baseurlpath) return;
    const pid = projectId || currentProject?.id;
    if (!pid) return;
    await loadVersion(pid, username, baseurlpath, version);
  };

  // ─── THEME‑AWARE STYLES ─────────────────────────────────────────
  const sidebarBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const headerBg = isWhiteTheme ? "bg-white/80" : "bg-zinc-900/80";
  const headerText = isWhiteTheme ? "text-gray-700" : "text-zinc-300";
  const cardBg = isWhiteTheme
    ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
    : "bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/40";
  const textMuted = isWhiteTheme ? "text-gray-400" : "text-zinc-500";
  const pathText = isWhiteTheme ? "text-blue-600" : "text-blue-400";
  const versionBtnBase = isWhiteTheme
    ? "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
    : "text-zinc-400 hover:bg-blue-600/10 hover:text-blue-400";

  return (
    <aside className={`flex shrink-0 overflow-hidden z-10 ${sidebarBg} border-l ${borderColor}`}>
      <div
        className={`
          flex flex-col overflow-hidden transition-all duration-300 ease-in-out
          ${isApiHistoryOpen ? "w-56 border-r" : "w-0 border-r-0"}
          ${borderColor}
        `}
      >
        {/* Header */}
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b shrink-0 ${headerBg} ${borderColor} ${headerText}`}>
          <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-2">
            <span>📜</span> History
          </span>
          {historyData.length > 0 && !loading && (
            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
              isWhiteTheme ? "bg-gray-200 text-gray-700" : "bg-zinc-700 text-zinc-300"
            }`}>
              {historyData.reduce((acc, ep) => acc + (ep.versions?.length || 0), 0)}
            </span>
          )}
        </div>

        {/* Content */}
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
          {loading && (
            <div className="flex justify-center py-6">
              <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isWhiteTheme ? "border-gray-300 border-t-gray-600" : "border-zinc-700 border-t-blue-400"}`} />
            </div>
          )}
          {error && <div className="text-center text-red-400 text-xs py-4">{error}</div>}
          {!loading && !error && historyData.length === 0 && (
            <div className={`text-center ${textMuted} italic text-xs py-4`}>
              No API history found.
            </div>
          )}
          {!loading && !error && historyData.map((endpoint, idx) => {
            const versions = endpoint.versions || [];
            const isExpanded = expanded[idx];
            const visibleVersions = isExpanded ? versions : versions.slice(0, INITIAL_SHOW);
            const totalVersions = versions.length;
            const remaining = totalVersions - INITIAL_SHOW;

            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 transition-all duration-200 ${cardBg} ${borderColor}`}
              >
                {/* Endpoint path */}
                <p className={`text-xs font-mono font-semibold break-all ${pathText}`}>
                  {endpoint.baseUrlPath || "unknown"}
                </p>

                {/* Version list */}
                <div className="mt-1.5 space-y-0.5">
                  {visibleVersions.map((v, vIdx) => (
                    <button
                      key={vIdx}
                      onClick={() => handleVersionClick(endpoint, v.version, v.fullUrl)}
                      className={`
                        block w-full text-left px-2 py-0.5 rounded text-xs font-mono
                        transition-all duration-150
                        ${versionBtnBase}
                      `}
                    >
                      <span className="opacity-50 mr-1">↳</span> {v.version}
                    </button>
                  ))}
                </div>

                {/* Expand/Collapse controls */}
                {!isExpanded && remaining > 0 && (
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="mt-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline transition-all flex items-center gap-1"
                  >
                    + {remaining} more version{remaining > 1 ? 's' : ''}
                  </button>
                )}
                {isExpanded && totalVersions > INITIAL_SHOW && (
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="mt-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:underline transition-all flex items-center gap-1"
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
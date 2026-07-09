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

  const projectId = propProjectId || currentProject?.id;

  const fetchHistory = useCallback(async () => {
    const username = user?.username;
    if (!projectId) return;
    if (!username || username === "Guest") {
      setError("Pleease log in to seee API history.");
      return;
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      // Use dedicated environment variable for API history
      const url = `${import.meta.env.VITE_API_URL_API_HISTORY}?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url, { signal: controller.signal, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      let data = await res.json();
      // Normalize if backendstill returns old format
      if (data.length && !data[0].versions && data[0].actualFullUrls) {
        data = data.map(ep => ({
          baseUrlPath: ep.baseUrlPath,
          versions: ep.actualFullUrls.map((url, idx) => ({
            version: `v${idx + 1}`,
            fullUrl: url
          }))
        }));
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

  // Socket.IO real‑time updates using shared socket
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

  const cardClass = isWhiteTheme ? "bg-gray-50 border-gray-200 text-gray-500" : "bg-[#1e1f22] border-zinc-700/50 text-gray-400";
  const buttonClass = isWhiteTheme ? "text-gray-400 hover:text-gray-700" : "text-zinc-500 hover:text-gray-200";

  return (
    <aside className={`flex shrink-0 overflow-hidden z-10 ${isWhiteTheme ? "bg-white border-l border-gray-200" : "bg-[#2b2d31] border-l border-zinc-700/50"}`}>
      <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isApiHistoryOpen ? "w-40 border-r" : "w-0 border-r-0"} ${isWhiteTheme ? "border-gray-200" : "border-zinc-700/50"}`}>
        <div className={`text-xs font-medium border-b p-2 flex justify-center shrink-0 ${isWhiteTheme ? "bg-gray-50 border-gray-200 text-gray-600" : "bg-[#232428] border-zinc-700/50 text-gray-300"}`}>API History</div>
        <div className="p-3 text-xs flex flex-col gap-3 flex-1 overflow-y-auto overflow-x-auto">
          {loading && <div className="text-center text-gray-400">Loading...</div>}
          {error && <div className="text-center text-red-400">{error}</div>}
          {!loading && !error && historyData.length === 0 && <div className="text-center text-gray-400">No API history found.</div>}
          {!loading && !error && historyData.map((endpoint, idx) => {
            const versions = endpoint.versions || [];
            const isExpanded = expanded[idx];
            const visibleVersions = isExpanded ? versions : versions.slice(0, INITIAL_SHOW);
            const remaining = versions.length - INITIAL_SHOW;
            return (
              <div key={idx} className={`border rounded p-3 w-full ${cardClass}`}>
                <p className="text-blue-400 font-medium mb-1 break-all">{endpoint.baseUrlPath || "unknown"}</p>
                {visibleVersions.map((v, vIdx) => (
                  <button
                    key={vIdx}
                    onClick={() => handleVersionClick(endpoint, v.version, v.fullUrl)}
                    className={`block ml-2 text-left w-full whitespace-nowrap ${buttonClass} cursor-pointer hover:text-blue-400 active:text-blue-500 transition-colors`}
                  >
                    ↳ {v.version}
                  </button>
                ))}
                {!isExpanded && remaining > 0 && (
                  <button onClick={() => toggleExpand(idx)} className="ml-2 mt-1 text-blue-400 hover:text-blue-300 cursor-pointer">
                    +{remaining} more...
                  </button>
                )}
                {isExpanded && (
                  <button onClick={() => toggleExpand(idx)} className="ml-2 mt-1 text-blue-400 hover:text-blue-300 cursor-pointer">
                    show less
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



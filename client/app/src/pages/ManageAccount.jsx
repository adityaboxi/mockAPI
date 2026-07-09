import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

function ManageAccount() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const w = theme === "white";
  const isAuthenticated = user && user.role !== "guest";

  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const userProjectsRef = useRef([]);
  const joinedRooms = useRef(new Set());


  const REQUESTS_RECEIVED_URL = import.meta.env.VITE_API_URL_REQUESTS_RECEIVED;
  const REQUESTS_SENT_URL = import.meta.env.VITE_API_URL_REQUESTS_SENT;
  const USER_APIS_URL = import.meta.env.VITE_API_URL_USER_APIS;
  const ACCEPT_REQUEST_BASE_URL = import.meta.env.VITE_API_URL_ACCEPT_REQUEST;
  const REVOKE_REQUEST_BASE_URL = import.meta.env.VITE_API_URL_REVOKE_REQUEST;
  const DELETE_VERSION_BASE_URL = import.meta.env.VITE_API_URL_DELETE_VERSION;

  const fetchSettingsData = useCallback(async () => {
    try {
      const [resReceived, resSent, resUserApis] = await Promise.all([
        fetch(REQUESTS_RECEIVED_URL, { credentials: "include" }),
        fetch(REQUESTS_SENT_URL, { credentials: "include" }),
        fetch(USER_APIS_URL, { credentials: "include" }),
      ]);

      if (resReceived.ok) {
        const receivedData = await resReceived.json();
        setReceivedRequests(
          receivedData.map((r) => ({
            id: r._id || r.id,
            projectName: r.projectName,
            requestedBy: r.requestedBy,
            projectId: r.projectId,
          }))
        );
      }
      if (resSent.ok) setSentRequests(await resSent.json());
      if (resUserApis.ok) {
        const projectsData = await resUserApis.json();
        setUserProjects(Array.isArray(projectsData) ? projectsData : []);
        userProjectsRef.current = Array.isArray(projectsData) ? projectsData : [];
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
    } finally {
      setLoading(false);
    }
  }, [REQUESTS_RECEIVED_URL, REQUESTS_SENT_URL, USER_APIS_URL]);

  // Join project rooms when projects load (only if socket is ready)
  useEffect(() => {
    if (!socket) return;
    userProjects.forEach((project) => {
      if (project.projectId && !joinedRooms.current.has(project.projectId)) {
        socket.emit("join_project", project.projectId);
        joinedRooms.current.add(project.projectId);
      }
    });
  }, [userProjects, socket]);

  // Socket event listeners and initial fetch
  useEffect(() => {
    if (!socket) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    fetchSettingsData();

    const userRoom = `user_${user?.username}`;
    if (!joinedRooms.current.has(userRoom)) {
      socket.emit("join_room", userRoom);
      joinedRooms.current.add(userRoom);
    }

    const handleIncomingJoinRequest = (data) => {
      setReceivedRequests((prev) => {
        const isDuplicate = prev.some(
          (req) => req.projectName === data.projectname && req.requestedBy === data.requestuser
        );
        if (isDuplicate) return prev;
        return [
          {
            id: data.id,
            projectName: data.projectname,
            requestedBy: data.requestuser,
            projectId: data.projectId,
          },
          ...prev,
        ];
      });
    };

    const handleJoinRequestRevoked = (data) => {
      if (data?.requestId) {
        setReceivedRequests((prev) => prev.filter((req) => req.id !== data.requestId));
      }
    };

    const handleJoinRequestApproved = (data) => {
      if (data?.requestId) {
        setSentRequests((prev) => prev.filter((req) => req.id !== data.requestId));
      }
    };

    const handleNewApiLog = (log) => {
      fetchSettingsData(); // always refresh on any API log event
    };

    socket.on("incoming_join_request", handleIncomingJoinRequest);
    socket.on("join_request_revoked", handleJoinRequestRevoked);
    socket.on("join_request_approved", handleJoinRequestApproved);
    socket.on("new_api_log", handleNewApiLog);

    return () => {
      socket.off("incoming_join_request", handleIncomingJoinRequest);
      socket.off("join_request_revoked", handleJoinRequestRevoked);
      socket.off("join_request_approved", handleJoinRequestApproved);
      socket.off("new_api_log", handleNewApiLog);
    };
  }, [isAuthenticated, user?.username, fetchSettingsData, socket]);

  const handleAcceptRequest = async (requestId) => {
    try {
      const response = await fetch(`${ACCEPT_REQUEST_BASE_URL}/${requestId}`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const handleRevokeRequest = async (requestId) => {
    try {
      const response = await fetch(`${REVOKE_REQUEST_BASE_URL}/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error revoking request:", error);
    }
  };

  const handleDeleteVersion = async (projectId, apiId, versionId) => {
    if (!projectId || !versionId) {
      console.warn("Missing projectId or versionId", { projectId, versionId });
      alert("Cannot delete version: missing identifier");
      return;
    }

    try {
      const url = `${DELETE_VERSION_BASE_URL}/${encodeURIComponent(versionId)}?projectId=${encodeURIComponent(projectId)}`;
      console.log("Deleting version ID:", versionId);

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // Optimistically remove the version from UI
        setUserProjects((prev) =>
          prev.map((project) => {
            if (project.projectId !== projectId) return project;
            const updatedApis = project.apis.map((api) => {
              if (api.apiId !== apiId) return api;
              // Filter using the correct identifier (_id)
              const filteredVersions = api.versions.filter((v) => v._id !== versionId);
              return { ...api, versions: filteredVersions };
            });
            // Remove the API entirely if it has no versions left
            return { ...project, apis: updatedApis.filter((api) => api.versions.length > 0) };
          })
        );
        console.log("Version deleted successfully");
      } else {
        const errorData = await response.json();
        console.error("Delete failed:", errorData);
        alert(errorData.error || "Failed to delete version");
      }
    } catch (error) {
      console.error("Error deleting version:", error);
      alert("Network error. Please try again.");
    }
  };

  // Loading state
  if (loading && !receivedRequests.length && !userProjects.length) {
    return (
      <div className={`w-full min-h-screen flex items-center justify-center ${w ? "bg-white" : "bg-[#1a202c]"}`}>
        <div
          className={`animate-spin h-5 w-5 border-2 rounded-full border-t-transparent ${
            w ? "border-blue-600" : "border-[#2bd9a1]"
          }`}
        ></div>
      </div>
    );
  }

  // Styles (unchanged)
  const mainWrapperBg = w ? "bg-white text-gray-800" : "bg-[#1a202c] text-[#e2e8f0]";
  const headerBorder = w ? "border-gray-200 bg-gray-50" : "border-[#2d3748] bg-[#232b3c]/40";
  const dividerLine = w ? "border-gray-200" : "border-[#2d3748]";
  const cardBg = w ? "bg-gray-50/50 border border-gray-200" : "bg-[#232b3c] border border-[#2d3748]";
  const innerCardBg = w ? "bg-white border border-gray-200/60" : "bg-[#1a202c] border border-[#2d3748]/40";
  const headerTxt = w ? "text-gray-900" : "text-[#e2e8f0]";
  const mutedTxt = w ? "text-gray-500" : "text-[#a0aec0]";
  const miniMutedTxt = w ? "text-gray-400" : "text-[#718096]";
  const highlightTxt = w ? "text-blue-600" : "text-[#2bd9a1]";

  const successBtn = w
    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors select-none shrink-0"
    : "bg-[#2bd9a1]/10 hover:bg-[#2bd9a1]/20 text-[#2bd9a1] border border-[#2bd9a1]/30 text-xs font-medium px-2.5 py-1.5 rounded transition-colors select-none shrink-0";
  const neutralBtn = w
    ? "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-medium px-2.5 py-1.5 rounded transition-colors select-none shrink-0"
    : "border border-[#2d3748] text-[#e2e8f0] bg-[#1a202c] hover:bg-[#2d3748]/50 text-xs font-medium px-2.5 py-1.5 rounded transition-colors select-none shrink-0";
  const dangerBtn = w
    ? "text-rose-600 hover:bg-rose-50 border border-transparent text-xs font-semibold px-2 py-1 rounded transition-colors select-none"
    : "text-rose-400 hover:bg-rose-500/10 border border-transparent text-xs font-medium px-2 py-1 rounded transition-colors select-none";

  return (
    <div className={`w-full min-h-screen flex flex-col transition-colors duration-150 ${mainWrapperBg}`}>
      <div className={`w-full h-12 flex items-center px-6 border-b shrink-0 ${headerBorder}`}>
        <button
          type="button"
          onClick={() => navigate("/setting")}
          className={`text-xs font-semibold flex items-center gap-1.5 transition-colors focus:outline-none ${
            w ? "text-gray-500 hover:text-gray-900" : "text-[#a0aec0] hover:text-white"
          }`}
        >
          <span>←</span> Back to Settings
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wide select-none">Account Identity Core</h1>
        <div className="w-24" />
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto p-6 space-y-8">
        {/* Requests Received & Sent */}
        <div className="flex flex-col md:grid md:grid-cols-2 gap-6 min-h-0">
          <div className="space-y-3 flex flex-col">
            <div className="flex flex-col select-none">
              <h2 className={`text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${miniMutedTxt}`}>
                <span>Request Received</span>
                {receivedRequests.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-blue-500 text-white animate-pulse">
                    {receivedRequests.length} Pending
                  </span>
                )}
              </h2>
              <p className={`text-[11px] ${mutedTxt}`}>Manage permission streams targeting your active assets.</p>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-75 pr-1 custom-scrollbar">
              {receivedRequests.map((req) => (
                <div key={req.id} className={`flex items-center justify-between p-3.5 rounded shadow-sm gap-2 ${cardBg}`}>
                  <div className="space-y-0.5 min-w-0">
                    <div className={`text-xs font-semibold truncate ${headerTxt}`}>{req.projectName}</div>
                    <div className={`text-[11px] ${mutedTxt} truncate`}>
                      by : <span className={`font-semibold ${highlightTxt}`}>@{req.requestedBy}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleAcceptRequest(req.id)} className={successBtn}>Approve</button>
                </div>
              ))}
              {receivedRequests.length === 0 && (
                <div className={`text-xs italic p-4 text-center border border-dashed rounded ${dividerLine} ${miniMutedTxt}`}>
                  No incoming requests present.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 flex flex-col">
            <div className="flex flex-col select-none">
              <h2 className={`text-xs font-bold tracking-wider uppercase ${miniMutedTxt}`}>Request Sent</h2>
              <p className={`text-[11px] ${mutedTxt}`}>Monitor validation status or pull back pending invites.</p>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-75 pr-1 custom-scrollbar">
              {sentRequests.map((req) => (
                <div key={req.id} className={`flex items-center justify-between p-3.5 rounded shadow-sm gap-2 ${cardBg}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded truncate max-w-40 ${innerCardBg} ${mutedTxt}`}>
                      code:{req.projectCode}
                    </span>
                    <span className="text-[11px] font-medium text-amber-500 capitalize select-none shrink-0">pending</span>
                  </div>
                  <button type="button" onClick={() => handleRevokeRequest(req.id)} className={neutralBtn}>revoke request</button>
                </div>
              ))}
              {sentRequests.length === 0 && (
                <div className={`text-xs italic p-4 text-center border border-dashed rounded ${dividerLine} ${miniMutedTxt}`}>
                  No outbound request records found.
                </div>
              )}
            </div>
          </div>
        </div>

        <hr className={dividerLine} />

        {/* APIs Grouped by Project */}
        <div className="space-y-3">
          <div className="flex flex-col select-none">
            <h2 className={`text-xs font-bold tracking-wider uppercase ${miniMutedTxt}`}>Your API Projects</h2>
            <p className={`text-[11px] ${mutedTxt}`}>APIs of your created projects. grouped by workspace.</p>
          </div>
          <div className="space-y-6">
            {userProjects.length === 0 && (
              <div className={`text-xs italic p-4 text-center border border-dashed rounded ${dividerLine} ${miniMutedTxt}`}>
                No projects with APIs yet.
              </div>
            )}
            {userProjects.map((project) => (
              <div key={project.projectId} className={`p-4 rounded shadow-sm flex flex-col gap-3 ${cardBg}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-500">📁 Project:</span>
                  <span className={`text-xs font-semibold ${headerTxt}`}>{project.projectName}</span>
                </div>
                <div className="ml-4 space-y-3">
                  {project.apis.map((api) => (
                    <div key={api.apiId} className={`p-3 rounded ${innerCardBg}`}>
                      <div className="flex items-center gap-1.5 font-mono text-xs mb-2">
                        <span className={`font-bold ${highlightTxt}`}>path:</span>
                        <span className={`font-semibold ${headerTxt}`}>{api.apiPath}</span>
                      </div>
                      <div className="space-y-1.5 pl-3 border-l-2 border-blue-500/30">
                        {api.versions.map((version) => (
                          <div key={version._id} className="flex items-center justify-between px-2 py-1 rounded">
                            <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                              <span className={`text-[11px] font-bold ${headerTxt}`}>version: {version.version}</span>
                              <span className={`text-xs font-mono truncate select-all ${mutedTxt}`}>{version.fullUrl}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteVersion(project.projectId, api.apiId, version._id)}
                              className={dangerBtn}
                            >
                              delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManageAccount;
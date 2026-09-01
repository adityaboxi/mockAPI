// src/pages/ManageAccount.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { apiClient } from "../services/apiClient";

function ManageAccount() {
  const { theme } = useTheme();
  const { user, subscribeUser, unsubscribeUser } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const w = theme === "white";
  const isAuthenticated = user && user.role !== "guest";

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(() => new Set());
  const userProjectsRef = useRef([]);
  const joinedRooms = useRef(new Set());

  const handleToggleSubscription = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    try {
      if (user?.subscribe) {
        const res = await unsubscribeUser();
        if (res.success) {
          showSuccess("Subscription downgraded to Free Tier.");
        } else {
          showError(res.error || "Failed to update subscription");
        }
      } else {
        const res = await subscribeUser();
        if (res.success) {
          showSuccess("✨ Successfully upgraded to Pro Plan (Simulated)!");
        } else {
          showError(res.error || "Failed to activate subscription");
        }
      }
    } catch (err) {
      showError(err.message || "Failed to process subscription");
    } finally {
      setIsSubscribing(false);
    }
  };

  const REQUESTS_RECEIVED_URL = import.meta.env.VITE_API_URL_REQUESTS_RECEIVED || '/api/requests/received';
  const REQUESTS_SENT_URL = import.meta.env.VITE_API_URL_REQUESTS_SENT || '/api/requests/sent';
  const USER_APIS_URL = import.meta.env.VITE_API_URL_USER_APIS || '/api/user-apis';
  const ACCEPT_REQUEST_BASE_URL = import.meta.env.VITE_API_URL_ACCEPT_REQUEST || '/api/requests/accept';
  const REVOKE_REQUEST_BASE_URL = import.meta.env.VITE_API_URL_REVOKE_REQUEST || '/api/requests/revoke';
  const DELETE_VERSION_BASE_URL = import.meta.env.VITE_API_URL_DELETE_VERSION || '/api/versions/delete';

  const fetchSettingsData = useCallback(async () => {
    try {
      const [receivedData, sentData, projectsData] = await Promise.all([
        apiClient.get(REQUESTS_RECEIVED_URL).catch(() => []),
        apiClient.get(REQUESTS_SENT_URL).catch(() => []),
        apiClient.get(USER_APIS_URL).catch(() => []),
      ]);

      if (Array.isArray(receivedData)) {
        setReceivedRequests(
          receivedData.map((r) => ({
            id: r._id || r.id,
            projectName: r.projectName,
            requestedBy: r.requestedBy,
            projectId: r.projectId,
          }))
        );
      }
      if (Array.isArray(sentData)) setSentRequests(sentData);
      if (Array.isArray(projectsData)) {
        setUserProjects(projectsData);
        userProjectsRef.current = projectsData;
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
    } finally {
      setLoading(false);
    }
  }, [REQUESTS_RECEIVED_URL, REQUESTS_SENT_URL, USER_APIS_URL]);

  // Join project rooms when projects load
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
            id: data.id || data._id,
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

    socket.on("incoming_join_request", handleIncomingJoinRequest);
    socket.on("join_request_revoked", handleJoinRequestRevoked);
    socket.on("join_request_approved", handleJoinRequestApproved);

    return () => {
      socket.off("incoming_join_request", handleIncomingJoinRequest);
      socket.off("join_request_revoked", handleJoinRequestRevoked);
      socket.off("join_request_approved", handleJoinRequestApproved);
    };
  }, [isAuthenticated, user?.username, fetchSettingsData, socket]);

  const handleAcceptRequest = async (requestId) => {
    if (processingIds.has(requestId)) return;
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      await apiClient.post(`${ACCEPT_REQUEST_BASE_URL}/${requestId}`);
      setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId));
      showSuccess("Join request approved!");
    } catch (error) {
      console.error("Error accepting request:", error.message);
      showError(error.message || "Failed to accept request");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleRevokeRequest = async (requestId) => {
    if (processingIds.has(requestId)) return;
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      await apiClient.delete(`${REVOKE_REQUEST_BASE_URL}/${requestId}`);
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      showSuccess("Join request revoked");
    } catch (error) {
      console.error("Error revoking request:", error.message);
      showError(error.message || "Failed to revoke request");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleDeleteVersion = async (projectId, apiId, versionId) => {
    if (!projectId || !versionId) {
      showWarning("Cannot delete version: missing identifier");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this API version?")) {
      return;
    }
    const actionKey = `${projectId}_${versionId}`;
    if (processingIds.has(actionKey)) return;
    setProcessingIds((prev) => new Set(prev).add(actionKey));

    try {
      const url = `${DELETE_VERSION_BASE_URL}/${encodeURIComponent(versionId)}?projectId=${encodeURIComponent(projectId)}`;
      await apiClient.delete(url);

      setUserProjects((prev) =>
        prev.map((project) => {
          if (project.projectId !== projectId) return project;
          const updatedApis = (project.apis || []).map((api) => {
            if (api.apiId !== apiId) return api;
            const filteredVersions = (api.versions || []).filter((v) => v._id !== versionId);
            return { ...api, versions: filteredVersions };
          });
          return { ...project, apis: updatedApis.filter((api) => api.versions.length > 0) };
        })
      );
      showSuccess("API version deleted successfully!");
    } catch (error) {
      console.error("Error deleting version:", error.message);
      showError(error.message || "Failed to delete version");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  // ─── Theme-aware styles ──────────────────────────────────────────
  const pageBg = w ? "bg-gray-50" : "bg-zinc-950";
  const textPrimary = w ? "text-gray-800" : "text-zinc-200";
  const textMuted = w ? "text-gray-500" : "text-zinc-400";
  const textMini = w ? "text-gray-400" : "text-zinc-500";
  const borderColor = w ? "border-gray-200" : "border-zinc-800";
  const headerBg = w ? "bg-white" : "bg-zinc-900";
  const cardBg = w ? "bg-white border-gray-200" : "bg-zinc-900 border-zinc-800";
  const innerCardBg = w ? "bg-gray-50 border-gray-200" : "bg-zinc-800/50 border-zinc-700";
  const highlight = w ? "text-blue-600" : "text-blue-400";
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";
  const buttonDanger = w
    ? "text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200"
    : "text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30";

  // Guest Guard
  if (!isAuthenticated && !loading) {
    return (
      <div className={`w-full min-h-screen flex items-center justify-center p-4 ${pageBg}`}>
        <div className={`p-8 rounded-2xl border shadow-lg w-full max-w-sm text-center ${cardBg}`}>
          <h2 className="text-lg font-semibold text-blue-500 mb-2">Account Required</h2>
          <p className={`text-sm mb-6 ${textMuted}`}>
            Please sign in to manage workspaces, join requests, and API versions.
          </p>
          <button
            onClick={() => navigate("/login")}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${buttonPrimary}`}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !receivedRequests.length && !userProjects.length) {
    return (
      <div className={`w-full min-h-screen flex items-center justify-center transition-colors duration-200 ${pageBg}`}>
        <div className={`animate-spin h-5 w-5 border-2 rounded-full border-t-transparent ${w ? "border-blue-600" : "border-blue-400"}`} />
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen flex flex-col transition-colors duration-200 ${pageBg} ${textPrimary}`}>
      {/* Header */}
      <header className={`w-full h-12 flex items-center px-6 border-b shrink-0 ${headerBg} ${borderColor}`}>
        <button
          type="button"
          onClick={() => navigate("/setting")}
          className={`text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 ${textMuted} hover:${textPrimary} ${w ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}`}
          aria-label="Back to settings"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back</span>
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wider select-none">Account Identity Core</h1>
        <div className="w-24" />
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 space-y-8 custom-scrollbar">
        {/* Subscription Plan Overview */}
        <div className={`p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${cardBg}`}>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Plan Tier</span>
              {user?.subscribe ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pro Active ($0 / Simulated)
                </span>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${innerCardBg} ${textMuted} border ${borderColor}`}>
                  Free Tier
                </span>
              )}
            </div>
            <p className={`text-xs ${textMuted}`}>
              {user?.subscribe
                ? "You have full access to 5 Workspaces, 30 Endpoints, 20 Versions, Unlimited AI Blueprints & High-Priority Mock Containers."
                : "Free tier is limited to 2 Workspaces, 5 Endpoints, and 5 Versions. Upgrade to unlock the full developer suite."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleSubscription}
            disabled={isSubscribing}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 ${
              user?.subscribe
                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25"
            } disabled:opacity-50 active:scale-95`}
          >
            {isSubscribing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : user?.subscribe ? (
              <span>Downgrade to Free</span>
            ) : (
              <span>✨ Upgrade to Pro (Simulated)</span>
            )}
          </button>
        </div>

        {/* Received & Sent requests */}
        <div className="flex flex-col md:grid md:grid-cols-2 gap-6 min-h-0">
          {/* Received */}
          <div className="space-y-3 flex flex-col">
            <div className="flex flex-col select-none">
              <div className="flex items-center gap-2">
                <h2 className={`text-xs font-bold tracking-wider uppercase ${textMini}`}>Received</h2>
                {receivedRequests.length > 0 && (
                  <span className="px-2 py-0.5 text-[9px] font-mono rounded-full bg-blue-500 text-white animate-pulse">
                    {receivedRequests.length} pending
                  </span>
                )}
              </div>
              <p className={`text-[11px] ${textMuted}`}>Manage permission streams targeting your active assets.</p>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-72 pr-1 custom-scrollbar">
              {receivedRequests.map((req) => {
                const isItemProcessing = processingIds.has(req.id);
                return (
                  <div key={req.id} className={`flex items-center justify-between p-3.5 rounded-xl border shadow-sm gap-2 ${cardBg}`}>
                    <div className="space-y-0.5 min-w-0">
                      <div className={`text-xs font-semibold truncate ${textPrimary}`}>{req.projectName}</div>
                      <div className={`text-[11px] ${textMuted} truncate`}>
                        by <span className={`font-semibold ${highlight}`}>@{req.requestedBy}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req.id)}
                      disabled={isItemProcessing}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${buttonPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        w ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isItemProcessing ? "Approving..." : "Approve"}
                    </button>
                  </div>
                );
              })}
              {receivedRequests.length === 0 && (
                <div className={`text-xs italic p-4 text-center border border-dashed rounded-xl ${borderColor} ${textMini}`}>
                  No incoming requests.
                </div>
              )}
            </div>
          </div>

          {/* Sent */}
          <div className="space-y-3 flex flex-col">
            <div className="flex flex-col select-none">
              <h2 className={`text-xs font-bold tracking-wider uppercase ${textMini}`}>Sent</h2>
              <p className={`text-[11px] ${textMuted}`}>Monitor validation status or pull back pending invites.</p>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-72 pr-1 custom-scrollbar">
              {sentRequests.map((req) => {
                const isItemProcessing = processingIds.has(req.id);
                return (
                  <div key={req.id} className={`flex items-center justify-between p-3.5 rounded-xl border shadow-sm gap-2 ${cardBg}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded truncate max-w-40 ${innerCardBg} ${textMuted}`}>
                        code: {req.projectCode}
                      </span>
                      <span className="text-[11px] font-medium text-amber-500 capitalize select-none shrink-0">pending</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeRequest(req.id)}
                      disabled={isItemProcessing}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${buttonPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        w ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isItemProcessing ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                );
              })}
              {sentRequests.length === 0 && (
                <div className={`text-xs italic p-4 text-center border border-dashed rounded-xl ${borderColor} ${textMini}`}>
                  No outbound requests.
                </div>
              )}
            </div>
          </div>
        </div>

        <hr className={`border-t ${borderColor}`} />

        {/* User Projects */}
        <div className="space-y-3">
          <div className="flex flex-col select-none">
            <h2 className={`text-xs font-bold tracking-wider uppercase ${textMini}`}>Your API Projects</h2>
            <p className={`text-[11px] ${textMuted}`}>APIs of your created projects, grouped by workspace.</p>
          </div>
          <div className="space-y-5">
            {userProjects.length === 0 && (
              <div className={`text-xs italic p-4 text-center border border-dashed rounded-xl ${borderColor} ${textMini}`}>
                No projects with APIs yet.
              </div>
            )}
            {userProjects.map((project) => (
              <div key={project.projectId} className={`p-4 rounded-xl border shadow-sm flex flex-col gap-3 ${cardBg}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-500">📁 Project:</span>
                  <span className={`text-xs font-semibold ${textPrimary}`}>{project.projectName}</span>
                </div>
                <div className="ml-4 space-y-3">
                  {(project.apis || []).map((api) => (
                    <div key={api.apiId} className={`p-3 rounded-lg border ${innerCardBg}`}>
                      <div className="flex items-center gap-1.5 font-mono text-xs mb-2">
                        <span className={`font-bold ${highlight}`}>path:</span>
                        <span className={`font-semibold ${textPrimary}`}>{api.apiPath}</span>
                      </div>
                      <div className="space-y-1.5 pl-3 border-l-2 border-blue-500/30">
                        {(api.versions || []).map((version) => {
                          const actionKey = `${project.projectId}_${version._id}`;
                          const isDeleting = processingIds.has(actionKey);
                          return (
                            <div key={version._id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                <span className={`text-[11px] font-bold ${textPrimary}`}>version: {version.version}</span>
                                <span className={`text-xs font-mono truncate select-all ${textMuted}`}>{version.fullUrl}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteVersion(project.projectId, api.apiId, version._id)}
                                disabled={isDeleting}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${buttonDanger} focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-50`}
                              >
                                {isDeleting ? "deleting..." : "delete"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default React.memo(ManageAccount);
// src/components/ProjectList/ProjectJoinInput.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

const ProjectJoinInput = React.memo(({ user, onProjectJoined, refreshProjects, isWhiteTheme }) => {
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { showSuccess, showError, showWarning } = useToast();
  const { user: authUser } = useAuth();
  
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleJoinProject = useCallback(async () => {
    const currentUser = user || authUser;
    if (!currentUser || currentUser.role === "guest") {
      showWarning("Please sign in to an account to join workspaces.");
      return;
    }
    const joinCode = joinCodeInput.trim();
    if (!joinCode) {
      showWarning("Please paste a valid join code.");
      return;
    }
    setIsJoining(true);
    try {
      const url = import.meta.env.VITE_API_URL_JOINPROJECT || '/api/join-project';
      const joinedProject = await apiClient.post(url, { joinCode });
      
      setJoinCodeInput("");
      showSuccess("Join request sent to project manager!");
      setSuccessMessage("Join request sent to manager!");

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setSuccessMessage("");
      }, 3000);

      if (refreshProjects) await refreshProjects();
      if (onProjectJoined) onProjectJoined(joinedProject);
    } catch (error) {
      showError(error.message || "Failed to join project with this code");
    } finally {
      setIsJoining(false);
    }
  }, [user, authUser, joinCodeInput, refreshProjects, onProjectJoined, showSuccess, showError, showWarning]);

  // ─── Theme-aware styles ─────────────────────────────────────────
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const inputPlaceholder = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const inputText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const labelText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const clearBtnBg = isWhiteTheme
    ? "bg-gray-100 hover:bg-gray-200 text-gray-500"
    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400";
  const clearBtnBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";

  return (
    <div className="flex flex-col gap-2">
      {/* Header: label + join button */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${labelText}`}>Join Project</span>
        <button
          type="button"
          onClick={handleJoinProject}
          disabled={isJoining || !joinCodeInput.trim()}
          className={`
            px-3 py-1 rounded text-xs font-medium transition-all
            bg-blue-600 hover:bg-blue-500 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          `}
        >
          {isJoining ? "Joining..." : "Join"}
        </button>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="Paste join code here..."
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleJoinProject();
            }
          }}
          disabled={isJoining}
          className={`
            flex-1 px-3 py-1.5 text-xs rounded outline-none transition-all font-mono
            ${inputBg} ${inputBorder} ${inputText} ${inputPlaceholder}
            ${inputFocus}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
        {joinCodeInput && (
          <button
            type="button"
            onClick={() => setJoinCodeInput("")}
            disabled={isJoining}
            className={`
              px-2.5 py-1.5 text-xs rounded border transition-all
              ${clearBtnBg} ${clearBtnBorder}
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:scale-105 active:scale-95
            `}
            aria-label="Clear join code input"
          >
            ✕
          </button>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="text-xs text-center text-emerald-500 mt-0.5 animate-pulse font-medium">
          {successMessage}
        </div>
      )}
    </div>
  );
});

ProjectJoinInput.displayName = "ProjectJoinInput";

export default ProjectJoinInput;
// src/components/ProjectList/ProjectCreateInput.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

const ProjectCreateInput = React.memo(({ user, onProjectCreated, isWhiteTheme }) => {
  const [newProjectNameInput, setNewProjectNameInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [globalInvitationCode, setGlobalInvitationCode] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const { showSuccess, showError, showWarning } = useToast();
  const { user: authUser } = useAuth();
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCreateProject = useCallback(async () => {
    const currentUser = user || authUser;
    if (!currentUser || currentUser.role === "guest") {
      showWarning("Please sign in to an account to create workspaces.");
      return;
    }
    const projectName = newProjectNameInput.trim();
    if (!projectName) {
      showWarning("Please enter a project name.");
      return;
    }
    setIsCreating(true);

    try {
      const url = import.meta.env.VITE_API_URL_CREATEPROJECT || '/api/create-project';
      const data = await apiClient.post(url, { projectname: projectName });
      const createdProj = data.project || data;
      if (data.invitationCode || createdProj.invitationCode) {
        setGlobalInvitationCode(data.invitationCode || createdProj.invitationCode);
      }
      setNewProjectNameInput("");
      showSuccess(`Project "${projectName}" created successfully!`);
      if (onProjectCreated) onProjectCreated(createdProj);
    } catch (error) {
      showError(error.message || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  }, [user, authUser, newProjectNameInput, onProjectCreated, showSuccess, showError, showWarning]);

  const copyInvitationCode = useCallback(async () => {
    if (!globalInvitationCode) return;

    const triggerSuccess = () => {
      setCopySuccess(true);
      showSuccess("Invitation code copied to clipboard!");
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopySuccess(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(globalInvitationCode);
        triggerSuccess();
        return;
      } catch (_) {}
    }

    const textarea = document.createElement("textarea");
    textarea.value = globalInvitationCode;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      triggerSuccess();
    } catch (_) {
    } finally {
      document.body.removeChild(textarea);
    }
  }, [globalInvitationCode, showSuccess]);

  // ---- Theme-aware styles ----
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const inputPlaceholder = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const inputText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const labelText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";

  const codeBg = isWhiteTheme ? "bg-blue-50 border-blue-300" : "bg-blue-950/30 border-blue-500/40";
  const codeText = isWhiteTheme ? "text-blue-700" : "text-blue-200";

  return (
    <div className="flex flex-col gap-2">
      {/* Header: label + action buttons */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${labelText}`}>Create Project</span>
        <div className="flex items-center gap-1.5">
          {globalInvitationCode && (
            <button
              type="button"
              onClick={() => setGlobalInvitationCode("")}
              className={`
                px-2 py-1 rounded text-xs transition-colors
                ${isWhiteTheme
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-500"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              `}
              aria-label="Clear invitation code display"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={handleCreateProject}
            disabled={isCreating || !newProjectNameInput.trim()}
            className={`
              px-3 py-1 rounded text-xs font-medium transition-all
              bg-blue-600 hover:bg-blue-500 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
            `}
          >
            {isCreating ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating
              </span>
            ) : (
              "+ New"
            )}
          </button>
        </div>
      </div>

      {/* Project name input */}
      <input
        type="text"
        placeholder="Enter workspace name..."
        value={newProjectNameInput}
        onChange={(e) => setNewProjectNameInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCreateProject();
          }
        }}
        disabled={isCreating}
        className={`
          w-full px-3 py-1.5 text-xs rounded outline-none transition-all
          ${inputBg} ${inputBorder} ${inputText} ${inputPlaceholder}
          ${inputFocus}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      />

      {/* Invitation code display */}
      {globalInvitationCode && (
        <div className={`flex items-center gap-2 border rounded p-1 pl-3 mt-0.5 ${codeBg}`}>
          <input
            type="text"
            readOnly
            value={globalInvitationCode}
            className={`flex-1 outline-none text-xs font-mono bg-transparent ${codeText}`}
          />
          <button
            type="button"
            onClick={copyInvitationCode}
            className={`
              px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1
              bg-blue-600 hover:bg-blue-500 text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
            `}
          >
            {copySuccess ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              "📋 Copy"
            )}
          </button>
        </div>
      )}
    </div>
  );
});

ProjectCreateInput.displayName = "ProjectCreateInput";

export default ProjectCreateInput;
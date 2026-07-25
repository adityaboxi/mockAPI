import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";

const API_PROJECTS = import.meta.env.VITE_API_URL_PROJECTS;
const API_RESET_INVITE = import.meta.env.VITE_API_URL_RESET_INVITE;
const API_VERIFY_INVITE_OTP = import.meta.env.VITE_API_URL_VERIFY_INVITE_OTP;
const API_UPDATE_PROJECT_STATUS = import.meta.env.VITE_API_UPDATE_PROJECT_STATUS;
const API_DELETE_PROJECT = import.meta.env.VITE_API_URL_DELETEPROJECT;

function ProjectDetailsModal({ project, isOpen, onClose, onStatusChange, onInvitationCodeUpdated }) {
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  // ---- State ----
  const [showOtpSection, setShowOtpSection] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [localInvitationCode, setLocalInvitationCode] = useState(() => project?.invitationCode || "");
  const [members, setMembers] = useState(project?.members || []);
  const [createdAt, setCreatedAt] = useState(project?.createdAt || "N/A");

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [successTarget, setSuccessTarget] = useState(null);

  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteTimeoutRef = useRef(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const intervalRef = useRef(null);
  const successTimeoutRef = useRef(null);

  // ---- Timer cleanup ----
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);
    };
  }, []);

  // ---- Fetch fresh members/createdAt when modal opens ----
  useEffect(() => {
    if (!isOpen || !project?.id) return;
    setLocalInvitationCode(project.invitationCode);
    fetch(API_PROJECTS, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const projects = Array.isArray(data) ? data : [];
        const fresh = projects.find((p) => p.id === project.id);
        if (fresh?.members) setMembers(fresh.members);
        if (fresh?.createdAt) setCreatedAt(fresh.createdAt);
      })
      .catch(console.error);
  }, [isOpen, project?.id]);

  // ---- Timer countdown ----
  useEffect(() => {
    if (timer > 0) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timer === 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timer]);

  // ---- Handlers (memoized) ----
  const handleResetCode = useCallback(async () => {
    setIsLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(API_RESET_INVITE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: project.id || project._id, projectName: project.projectname }),
      });
      if (res.ok) {
        setShowOtpSection(true);
        setTimer(120);
      } else {
        const err = await res.json();
        setOtpError(err.error || "Failed to send OTP");
      }
    } catch (e) {
      setOtpError("Network error");
    } finally {
      setIsLoading(false);
    }
  }, [project.id, project._id, project.projectname]);

  const handleVerifyOtp = useCallback(async () => {
    if (!otpCode) return;
    setIsLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(API_VERIFY_INVITE_OTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: project.id || project._id, otp: otpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalInvitationCode(data.newInvitationCode);
        if (onInvitationCodeUpdated) onInvitationCodeUpdated(project.id, data.newInvitationCode);
        setShowOtpSection(false);
        setOtpCode("");
        onClose();
      } else {
        setOtpError(data.error || "Verification failed");
      }
    } catch (err) {
      setOtpError("Network error");
    } finally {
      setIsLoading(false);
    }
  }, [otpCode, project.id, project._id, onInvitationCodeUpdated, onClose]);

  const handleStatusChange = useCallback(async (newStatus, target) => {
    if (statusUpdating) return;
    setStatusUpdating(true);
    setStatusError(null);
    const projectId = project.id || project._id;
    try {
      const res = await fetch(`${API_UPDATE_PROJECT_STATUS}/${projectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.ok) {
        if (onStatusChange) onStatusChange(newStatus);
        setSuccessTarget(target);
        setStatusSuccess(true);
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = setTimeout(() => {
          setStatusSuccess(false);
          setSuccessTarget(null);
        }, 2000);
      } else {
        const err = await res.json();
        setStatusError(err.error || "Failed to update status");
      }
    } catch (e) {
      setStatusError("Network error");
    } finally {
      setStatusUpdating(false);
    }
  }, [project.id, project._id, statusUpdating, onStatusChange]);

  const copyInvitationCode = useCallback(async () => {
    if (!localInvitationCode) return;

    const showCopied = () => {
      setInviteCopied(true);
      if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);
      inviteTimeoutRef.current = setTimeout(() => setInviteCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(localInvitationCode);
        showCopied();
        return;
      } catch (err) {
        console.error("Clipboard write failed, falling back:", err);
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = localInvitationCode;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showCopied();
    } catch (err) {
      console.error("Fallback copy failed:", err);
    } finally {
      document.body.removeChild(textarea);
    }
  }, [localInvitationCode]);

  const handleDeleteProject = useCallback(async () => {
    if (isDeleting) return;
    const invitationCode = localInvitationCode || project?.invitationCode;
    if (!invitationCode) {
      setDeleteError("Missing invitation code - cannot delete project");
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(API_DELETE_PROJECT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invitationCode }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to delete project");
      }
      onClose();
    } catch (err) {
      setDeleteError(err.message);
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, localInvitationCode, project?.invitationCode, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ---- Render ----
  if (!isOpen) return null;

  const displayMembers = members.length > 0 ? members : ["No members yet"];
  const isActive = project.isActive !== false;

  // ---- Theme‑aware styles ----
  const modalBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const textPrimary = isWhiteTheme ? "text-gray-800" : "text-zinc-100";
  const textSecondary = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-800";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const inputFocus = "focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className={`rounded-2xl border shadow-2xl p-6 space-y-5 w-96 max-w-[95vw] max-h-[90vh] overflow-y-auto ${modalBg} ${borderColor} ${textPrimary}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-2.5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="text-blue-500">⚙️</span> Workspace Settings
          </h3>
          <button
            onClick={handleClose}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isWhiteTheme ? "hover:bg-gray-100 text-gray-500" : "hover:bg-zinc-800 text-zinc-400"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            ✕
          </button>
        </div>

        {/* Project details grid */}
        <div className="space-y-3 text-sm">
          {/* Invitation code row */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>Invite Code</span>
            <div className="flex items-center gap-2 cursor-pointer" onClick={copyInvitationCode}>
              <code className={`font-mono text-xs font-bold px-2 py-1 rounded ${isWhiteTheme ? "bg-gray-100 text-indigo-600" : "bg-zinc-800 text-indigo-400"}`}>
                {localInvitationCode}
              </code>
              <span className="relative w-4 h-4 inline-block">
                <svg
                  key={inviteCopied ? "check" : "copy"}
                  className={`w-4 h-4 absolute inset-0 transition-all duration-200 ease-out ${
                    inviteCopied
                      ? "text-green-500 scale-110 opacity-100"
                      : `${textSecondary} hover:text-blue-400 scale-100 opacity-100`
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {inviteCopied ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  )}
                </svg>
              </span>
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>Status</span>
            <span className={`text-xs font-medium flex items-center gap-1.5 ${isActive ? "text-emerald-400" : "text-amber-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Created at */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>Created</span>
            <code className={`font-mono text-xs ${textSecondary}`}>{createdAt}</code>
          </div>

          {/* Delete project */}
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <span className={`text-xs font-medium ${textSecondary}`}>Delete project</span>
            <button
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className={`
                px-3 py-1 rounded text-xs font-medium transition-all
                bg-red-600 hover:bg-red-500 text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
                ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              `}
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Deleting
                </span>
              ) : (
                "Confirm Delete"
              )}
            </button>
          </div>
          {deleteError && <p className="text-red-400 text-xs text-right -mt-1">{deleteError}</p>}
        </div>

        {/* Members section */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center mb-2">
            <span className={`text-xs font-semibold ${textSecondary}`}>👥 Members</span>
            <span className="text-[10px] font-mono text-zinc-500">{members.length} total</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {displayMembers.map((member, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs px-1 py-0.5">
                <span className={`text-blue-400 ${isWhiteTheme ? "text-blue-500" : "text-blue-400"}`}>•</span>
                <span className="truncate">{member === "No members yet" ? member : `@${member}`}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status toggle buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={() => handleStatusChange(true, "active")}
            disabled={isActive || statusUpdating}
            className={`
              flex-1 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5
              ${statusSuccess && successTarget === "active"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }
              disabled:opacity-40 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
            `}
          >
            {statusSuccess && successTarget === "active" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Active!
              </>
            ) : (
              "Set Active"
            )}
          </button>
          <button
            onClick={() => handleStatusChange(false, "inactive")}
            disabled={!isActive || statusUpdating}
            className={`
              flex-1 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5
              ${statusSuccess && successTarget === "inactive"
                ? "bg-amber-600 text-white"
                : "bg-amber-600 hover:bg-amber-500 text-white"
              }
              disabled:opacity-40 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
            `}
          >
            {statusSuccess && successTarget === "inactive" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Inactive!
              </>
            ) : (
              "Set Inactive"
            )}
          </button>
        </div>
        {statusError && <p className="text-red-400 text-xs text-center">{statusError}</p>}

        {/* Reset code / OTP section */}
        <div className="border-t pt-3">
          <button
            onClick={handleResetCode}
            disabled={isLoading}
            className={`
              w-full py-1.5 rounded text-xs font-medium transition-all
              bg-blue-600 hover:bg-blue-500 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
            `}
          >
            {isLoading ? "Sending..." : "Reset Invitation Code"}
          </button>

          {showOtpSection && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-center text-zinc-500">Enter OTP sent to your email</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit OTP"
                  className={`
                    flex-1 px-3 py-1.5 text-xs rounded border outline-none transition-all
                    ${inputBg} ${inputBorder} ${inputFocus}
                    ${isWhiteTheme ? "text-gray-800" : "text-zinc-200"}
                  `}
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={isLoading || !otpCode}
                  className={`
                    px-4 py-1.5 rounded text-xs font-medium transition-all
                    bg-emerald-600 hover:bg-emerald-500 text-white
                    disabled:opacity-50 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
                    ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
                  `}
                >
                  Verify
                </button>
              </div>
              {otpError && <p className="text-red-400 text-xs text-center">{otpError}</p>}
              {timer > 0 && (
                <p className="text-xs text-center text-zinc-500">
                  Resend available in <span className="font-mono">{timer}</span>s
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProjectDetailsModal);
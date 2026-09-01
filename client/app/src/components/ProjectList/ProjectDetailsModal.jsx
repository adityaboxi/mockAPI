// src/components/ProjectList/ProjectDetailsModal.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../services/apiClient";

const API_PROJECTS = import.meta.env.VITE_API_URL_PROJECTS || '/api/projects';
const API_RESET_INVITE = import.meta.env.VITE_API_URL_RESET_INVITE || '/api/reset-invitation-code';
const API_VERIFY_INVITE_OTP = import.meta.env.VITE_API_URL_VERIFY_INVITE_OTP || '/api/verify-invitationcode-otp';
const API_UPDATE_PROJECT_STATUS = import.meta.env.VITE_API_UPDATE_PROJECT_STATUS || '/api/projects';
const API_DELETE_PROJECT = import.meta.env.VITE_API_URL_DELETEPROJECT || '/api/deleteproject';

function ProjectDetailsModal({ project, isOpen, onClose, onStatusChange, onInvitationCodeUpdated }) {
  const { theme } = useTheme();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const isWhiteTheme = theme === "white";

  // ---- State ----
  const [members, setMembers] = useState(() => project?.members || []);
  const [showOtpSection, setShowOtpSection] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [localInvitationCode, setLocalInvitationCode] = useState(() => project?.invitationCode || "");
  const [createdAt, setCreatedAt] = useState(project?.createdAt || "N/A");

  const formattedCreatedAt = useMemo(() => {
    if (!createdAt || createdAt === "N/A") return "Recently created";
    try {
      let num = typeof createdAt === "string" ? Number(createdAt) : createdAt;
      if (!isNaN(num) && typeof num === "number" && num > 0) {
        if (num < 1e11) num = num * 1000;
        const d = new Date(num);
        if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      return "Recently created";
    } catch {
      return "Recently created";
    }
  }, [createdAt]);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [successTarget, setSuccessTarget] = useState(null);

  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteTimeoutRef = useRef(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // ---- Subscribe / Unsubscribe state ----
  const [isSubscribed, setIsSubscribed] = useState(() => project?.issubdcribe || false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [unsubscribeSuccess, setUnsubscribeSuccess] = useState(false);

  const intervalRef = useRef(null);
  const successTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // ---- Cleanup ----
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ---- Fetch fresh members/createdAt when modal opens ----
  useEffect(() => {
    if (!isOpen || !project?.id) return;
    setLocalInvitationCode(project.invitationCode || "");
    setIsSubscribed(project.issubdcribe || false);
    apiClient
      .get(API_PROJECTS)
      .then((data) => {
        if (!mountedRef.current) return;
        const projects = Array.isArray(data) ? data : [];
        const fresh = projects.find((p) => p.id === project.id);
        if (fresh?.members) setMembers(fresh.members);
        if (fresh?.createdAt) setCreatedAt(fresh.createdAt);
        if (fresh?.issubdcribe !== undefined) setIsSubscribed(fresh.issubdcribe);
      })
      .catch(() => {});
  }, [isOpen, project?.id, project?.invitationCode, project?.issubdcribe]);

  // ---- Timer countdown ----
  useEffect(() => {
    if (timer > 0) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timer === 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer]);

  // ---- Handlers ----
  const handleResetCode = useCallback(async () => {
    setIsLoading(true);
    setOtpError(null);
    try {
      await apiClient.post(API_RESET_INVITE, {
        project_id: project.id || project._id,
        projectName: project.projectname,
      });
      if (mountedRef.current) {
        setShowOtpSection(true);
        setTimer(120);
      }
      showInfo("Reset OTP sent to your registered email.");
    } catch (e) {
      if (mountedRef.current) setOtpError(e.message || "Failed to send OTP");
      showError(e.message || "Failed to send OTP");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [project.id, project._id, project.projectname, showInfo, showError]);

  const handleVerifyOtp = useCallback(async () => {
    if (!otpCode.trim()) return;
    setIsLoading(true);
    setOtpError(null);
    try {
      const data = await apiClient.post(API_VERIFY_INVITE_OTP, {
        project_id: project.id || project._id,
        otp: otpCode.trim(),
      });
      if (mountedRef.current) {
        setLocalInvitationCode(data.newInvitationCode);
        setShowOtpSection(false);
        setOtpCode("");
      }
      if (onInvitationCodeUpdated) onInvitationCodeUpdated(project.id, data.newInvitationCode);
      showSuccess("Invitation code regenerated successfully!");
      onClose();
    } catch (err) {
      if (mountedRef.current) setOtpError(err.message || "Verification failed");
      showError(err.message || "Verification failed");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [otpCode, project.id, project._id, onInvitationCodeUpdated, onClose, showSuccess, showError]);

  const handleStatusChange = useCallback(async (newStatus, target) => {
    if (statusUpdating) return;
    setStatusUpdating(true);
    setStatusError(null);
    const projectId = project.id || project._id;
    try {
      await apiClient.patch(`${API_UPDATE_PROJECT_STATUS}/${projectId}/status`, {
        isActive: newStatus,
      });
      if (onStatusChange) onStatusChange(newStatus);
      if (mountedRef.current) {
        setSuccessTarget(target);
        setStatusSuccess(true);
      }
      showSuccess(`Project marked as ${newStatus ? 'Active' : 'Inactive'}`);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setStatusSuccess(false);
          setSuccessTarget(null);
        }
      }, 2000);
    } catch (e) {
      if (mountedRef.current) setStatusError(e.message || "Failed to update status");
      showError(e.message || "Failed to update status");
    } finally {
      if (mountedRef.current) setStatusUpdating(false);
    }
  }, [project.id, project._id, statusUpdating, onStatusChange, showSuccess, showError]);

  const copyInvitationCode = useCallback(async () => {
    if (!localInvitationCode) return;

    const showCopied = () => {
      if (mountedRef.current) setInviteCopied(true);
      showSuccess("Invitation code copied to clipboard!");
      if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);
      inviteTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setInviteCopied(false);
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(localInvitationCode);
        showCopied();
        return;
      } catch (_) {}
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
    } catch (_) {
    } finally {
      document.body.removeChild(textarea);
    }
  }, [localInvitationCode, showSuccess]);

  const handleDeleteProject = useCallback(async () => {
    if (isDeleting) return;
    const invitationCode = localInvitationCode || project?.invitationCode;
    const projectId = project?.id || project?._id;
    if (!invitationCode && !projectId) {
      setDeleteError("Missing project identifier - cannot delete project");
      showError("Missing project identifier - cannot delete project");
      return;
    }

    if (!window.confirm("Are you sure you want to permanently delete this workspace and all its API endpoints?")) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(API_DELETE_PROJECT, {
        invitationCode,
        projectId,
      });
      showSuccess("Project deleted successfully");
      onClose();
    } catch (err) {
      if (mountedRef.current) setDeleteError(err.message || "Failed to delete project");
      showError(err.message || "Failed to delete project");
    } finally {
      if (mountedRef.current) setIsDeleting(false);
    }
  }, [isDeleting, localInvitationCode, project?.invitationCode, project?.id, project?._id, onClose, showSuccess, showError]);

  // ---- Subscribe handler ----
  const handleSubscribe = useCallback(async () => {
    if (isSubscribing || isSubscribed) return;
    setIsSubscribing(true);
    setSubscribeError(null);
    try {
      await apiClient.post("/api/subscribeproject", { projectId: project.id });
      if (mountedRef.current) {
        setIsSubscribed(true);
        setSubscribeSuccess(true);
      }
      showSuccess("Subscribed to workspace telemetry updates!");
      setTimeout(() => {
        if (mountedRef.current) setSubscribeSuccess(false);
      }, 3000);
    } catch (err) {
      if (mountedRef.current) setSubscribeError(err.message || "Subscription failed");
      showError(err.message || "Subscription failed");
    } finally {
      if (mountedRef.current) setIsSubscribing(false);
    }
  }, [project.id, isSubscribing, isSubscribed, showSuccess, showError]);

  // ---- Unsubscribe handler ----
  const handleUnsubscribe = useCallback(async () => {
    if (isUnsubscribing || !isSubscribed) return;
    setIsUnsubscribing(true);
    setSubscribeError(null);
    try {
      await apiClient.post("/api/unsubscribeproject", { projectId: project.id });
      if (mountedRef.current) {
        setIsSubscribed(false);
        setUnsubscribeSuccess(true);
      }
      showInfo("Unsubscribed from workspace telemetry.");
      setTimeout(() => {
        if (mountedRef.current) setUnsubscribeSuccess(false);
      }, 3000);
    } catch (err) {
      if (mountedRef.current) setSubscribeError(err.message || "Unsubscription failed");
      showError(err.message || "Unsubscription failed");
    } finally {
      if (mountedRef.current) setIsUnsubscribing(false);
    }
  }, [project.id, isUnsubscribing, isSubscribed, showInfo, showError]);

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

  const isSubscribingOrUnsubscribing = isSubscribing || isUnsubscribing;
  const buttonDisabled = isSubscribingOrUnsubscribing;
  const buttonText = isSubscribing
    ? "Subscribing"
    : isUnsubscribing
    ? "Unsubscribing"
    : isSubscribed
    ? "Unsubscribe"
    : "Subscribe";
  const buttonStyle = isSubscribed
    ? "bg-rose-600 hover:bg-rose-500 text-white"
    : "bg-blue-600 hover:bg-blue-500 text-white";
  const buttonDisabledStyle = isSubscribed
    ? "bg-rose-600/50"
    : "bg-blue-600/50";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`rounded-2xl border shadow-2xl p-6 space-y-5 w-96 max-w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar ${modalBg} ${borderColor} ${textPrimary}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-2.5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="text-blue-500" aria-hidden="true">⚙️</span> Workspace Settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isWhiteTheme ? "hover:bg-gray-100 text-gray-500" : "hover:bg-zinc-800 text-zinc-400"
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label="Close workspace settings"
          >
            ✕
          </button>
        </div>

        {/* Project details grid */}
        <div className="space-y-3 text-sm">
          {/* Invitation code row */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>Invite Code</span>
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={copyInvitationCode}>
              <code className={`font-mono text-xs font-bold px-2 py-1 rounded ${isWhiteTheme ? "bg-gray-100 text-indigo-600" : "bg-zinc-800 text-indigo-400"}`}>
                {localInvitationCode}
              </code>
              <span className="relative w-4 h-4 inline-block">
                <svg
                  key={inviteCopied ? "check" : "copy"}
                  className={`w-4 h-4 absolute inset-0 transition-all duration-200 ease-out ${
                    inviteCopied
                      ? "text-emerald-500 scale-110 opacity-100"
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
            <code className={`font-mono text-xs ${textSecondary}`}>{formattedCreatedAt}</code>
          </div>

          {/* Delete project */}
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <span className={`text-xs font-medium ${textSecondary}`}>Delete workspace</span>
            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className={`
                px-3 py-1 rounded text-xs font-medium transition-all
                bg-rose-600 hover:bg-rose-500 text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1
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
          {deleteError && <p className="text-rose-400 text-xs text-right -mt-1">{deleteError}</p>}

          {/* Subscribe / Unsubscribe button */}
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <span className={`text-xs font-medium ${textSecondary}`}>Subscription</span>
            <button
              type="button"
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={buttonDisabled}
              className={`
                px-3 py-1 rounded text-xs font-medium transition-all
                ${buttonDisabled ? buttonDisabledStyle : buttonStyle}
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-offset-1
                ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
                ${isSubscribed ? "focus:ring-rose-500" : "focus:ring-blue-500"}
              `}
            >
              {isSubscribing || isUnsubscribing ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {buttonText}
                </span>
              ) : (
                buttonText
              )}
            </button>
          </div>
          {subscribeSuccess && (
            <p className="text-emerald-400 text-xs text-right">✅ Subscription activated!</p>
          )}
          {unsubscribeSuccess && (
            <p className="text-amber-400 text-xs text-right">↩️ Unsubscribed</p>
          )}
          {subscribeError && (
            <p className="text-rose-400 text-xs text-right">{subscribeError}</p>
          )}
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
            type="button"
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
            type="button"
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
        {statusError && <p className="text-rose-400 text-xs text-center">{statusError}</p>}

        {/* Reset code / OTP section */}
        <div className="border-t pt-3">
          <button
            type="button"
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
                    flex-1 px-3 py-1.5 text-xs rounded border outline-none transition-all font-mono
                    ${inputBg} ${inputBorder} ${inputFocus}
                    ${isWhiteTheme ? "text-gray-800" : "text-zinc-200"}
                  `}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || !otpCode.trim()}
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
              {otpError && <p className="text-rose-400 text-xs text-center">{otpError}</p>}
              {timer > 0 && (
                <p className="text-xs text-center text-zinc-500">
                  Resend available in <span className="font-mono font-bold text-blue-400">{timer}</span>s
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
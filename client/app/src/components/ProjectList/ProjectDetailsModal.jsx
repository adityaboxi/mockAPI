import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";

const API_PROJECTS = import.meta.env.VITE_API_URL_PROJECTS;
const API_RESET_INVITE = import.meta.env.VITE_API_URL_RESET_INVITE;
const API_VERIFY_INVITE_OTP = import.meta.env.VITE_API_URL_VERIFY_INVITE_OTP;
const API_UPDATE_PROJECT_STATUS = import.meta.env.VITE_API_UPDATE_PROJECT_STATUS;
const API_DELETE_PROJECT = import.meta.env.VITE_API_URL_DELETEPROJECT;

function ProjectDetailsModal({ project, isOpen, onClose, onStatusChange, onInvitationCodeUpdated}) {
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
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
  const [successTarget, setSuccessTarget] = useState(null);

  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteTimeoutRef = useRef(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const intervalRef = useRef(null);
  const successTimeoutRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);
    };
  }, []);

  const handleResetCode = async () => {
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
  };

  const handleVerifyOtp = async () => {
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
  };

  const handleStatusChange = async (newStatus, target) => {
    if (statusUpdating) return;
    setStatusUpdating(true);
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
        alert(err.error || "Failed to update status");
      }
    } catch (e) {
      // silent, mirrors original behavior
    } finally {
      setStatusUpdating(false);
    }
  };

  const copyInvitationCode = async () => {
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

    // Fallback for non-secure contexts / older browsers
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
  };

  const handleDeleteProject = async () => {
    if (isDeleting) return;

    // ✅ Use local state if available, else fallback to prop
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

      const result = await response.json();
      onClose();
    } catch (err) {
      setDeleteError(err.message);
      console.error("❌ Deleeete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;
  const displayMembers = members.length > 0 ? members : ["No members yet"];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`rounded-xl border shadow-xl p-4 space-y-4 w-80 ${
          isDarkTheme ? "bg-[#18181b] text-white border-zinc-800" : "bg-white text-zinc-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-xs font-bold">Workspace Configuration</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <span>Code:</span>
            <div className="flex items-center gap-2 cursor-pointer" onClick={copyInvitationCode}>
              <code className="text-indigo-400 font-mono font-bold">{localInvitationCode}</code>
              <span className="relative w-3.5 h-3.5 inline-block">
                <svg
                  key={inviteCopied ? "check" : "copy"}
                  className={`w-3.5 h-3.5 absolute inset-0 transition-all duration-200 ease-out ${
                    inviteCopied
                      ? "text-green-500 scale-100 opacity-100"
                      : "text-gray-400 hover:text-gray-300 scale-100 opacity-100"
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
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={project.isActive !== false ? "text-emerald-400" : "text-red-400"}>
              {project.isActive !== false ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Time created:</span>
            <code className="text-indigo-400 font-mono font-bold">{project.createdAt || "N/A"}</code>
          </div>

          <div className="flex justify-between items-center">
            <div>Delete project:</div>
            <button
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className={`bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded ${
                isDeleting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isDeleting ? "Deleting..." : "Confirm"}
            </button>
          </div>
          {deleteError && <p className="text-red-400 text-xs text-right">{deleteError}</p>}
        </div>

        <div className="border-t pt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold">Members</span>
            <span className="text-[10px] text-zinc-500">{members.length} total</span>
          </div>
          <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
            {displayMembers.map((member, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="text-indigo-400">👤</span>
                <span className="truncate">{member === "No members yet" ? member : `@${member}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={() => handleStatusChange(true, "active")}
            disabled={project.isActive === true || statusUpdating}
            className={`flex-1 py-1 text-xs rounded text-white transition-colors flex items-center justify-center gap-1 ${
              statusSuccess && successTarget === "active" ? "bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-500"
            } disabled:opacity-40`}
          >
            {statusSuccess && successTarget === "active" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Active!</span>
              </>
            ) : (
              "Set Active"
            )}
          </button>
          <button
            onClick={() => handleStatusChange(false, "inactive")}
            disabled={project.isActive === false || statusUpdating}
            className={`flex-1 py-1 text-xs rounded text-white transition-colors flex items-center justify-center gap-1 ${
              statusSuccess && successTarget === "inactive" ? "bg-red-600" : "bg-red-600 hover:bg-red-500"
            } disabled:opacity-40`}
          >
            {statusSuccess && successTarget === "inactive" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Inactive!</span>
              </>
            ) : (
              "Set Inactive"
            )}
          </button>
        </div>

        <div className="border-t pt-3">
          <button
            onClick={handleResetCode}
            disabled={isLoading}
            className="w-full py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Reset Invitation Code"}
          </button>
          {showOtpSection && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-center">Enter OTP sent to your email</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit OTP"
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    isDarkTheme ? "border-zinc-700 bg-zinc-800 text-white" : "border-gray-300 bg-white text-gray-900"
                  }`}
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={isLoading || !otpCode}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
              {otpError && <p className="text-red-400 text-xs text-center">{otpError}</p>}
              {timer > 0 && <p className="text-xs text-center text-gray-500">Resend available in {timer}s</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProjectDetailsModal);





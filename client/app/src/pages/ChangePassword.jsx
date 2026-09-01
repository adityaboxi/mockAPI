// src/pages/ChangePassword.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../services/apiClient";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, isGuest } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const isWhiteTheme = theme === "white";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!user || isGuest) {
      navigate("/login", { replace: true });
    }
  }, [user, isGuest, navigate]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    const cleanCurrent = currentPassword.trim();
    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanCurrent) {
      showWarning("Please enter your existing password.");
      return;
    }
    if (cleanNew.length < 6) {
      showWarning("New password must be at least 6 characters.");
      return;
    }
    if (cleanNew !== cleanConfirm) {
      showWarning("Passwords do not match.");
      return;
    }
    if (cleanCurrent === cleanNew) {
      showWarning("New password cannot be identical to your current password.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/api/change-password', {
        currentPassword: cleanCurrent,
        newPassword: cleanNew,
      });
      showSuccess("Password updated successfully!");
      redirectTimerRef.current = setTimeout(() => {
        navigate("/setting", { replace: true });
      }, 1000);
    } catch (err) {
      showError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, navigate, showSuccess, showError, showWarning]);

  // ─── Theme styles ──────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-[#f8fafc]" : "bg-[#09090b]";
  const pageText = isWhiteTheme ? "text-slate-800" : "text-zinc-200";
  const headerBg = isWhiteTheme
    ? "bg-white/80 border-slate-200/80 backdrop-blur-md"
    : "bg-[#0c0c0e]/80 border-zinc-800/60 backdrop-blur-md";
  const cardBg = isWhiteTheme ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800";
  const borderColor = isWhiteTheme ? "border-slate-200" : "border-zinc-800";
  const inputBg = isWhiteTheme ? "bg-slate-50" : "bg-zinc-950/70";
  const inputBorder = isWhiteTheme ? "border-slate-200" : "border-zinc-800";
  const labelText = isWhiteTheme ? "text-slate-600" : "text-zinc-400";
  const inputBase = `w-full rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none transition-all border ${inputBg} ${inputBorder} focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-current`;

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${pageBg} ${pageText}`}>
      <header className={`h-[52px] flex items-center px-6 border-b shrink-0 ${headerBg} ${borderColor}`}>
        <button
          type="button"
          onClick={() => navigate("/setting")}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
            isWhiteTheme ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          }`}
          aria-label="Back to settings"
        >
          ← Back
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wider uppercase select-none">
          Security & Password
        </h1>
        <div className="w-16" />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className={`p-8 rounded-2xl border ${cardBg} max-w-sm w-full shadow-xl space-y-6`}>
          <div className="text-center space-y-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto text-base font-bold mb-2 select-none">
              🔒
            </div>
            <h2 className="text-base font-bold">Update Account Password</h2>
            <p className={`text-xs ${labelText}`}>Ensure your account remains safe with a strong passkey.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className={inputBase}
                required
                disabled={loading}
                autoComplete="current-password"
                autoFocus
              />
            </div>

            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className={inputBase}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 uppercase tracking-wide ${labelText}`}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={inputBase}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? "Updating..." : "Save New Password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default React.memo(ChangePassword);
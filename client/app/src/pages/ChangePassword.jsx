import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, isGuest } = useAuth();
  const isWhiteTheme = theme === "white";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    if (!user || isGuest) {
      navigate("/login");
    }
  }, [user, isGuest, navigate]);

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return showMessage("New password must be at least 6 characters.", "error");
    }
    if (newPassword !== confirmPassword) {
      return showMessage("Passwords do not match.", "error");
    }
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${apiBase}/api/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include", // ✅ This sends the cookie automatically
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update password.");
      }

      showMessage("Password updated successfully!", "success");
      setTimeout(() => navigate("/settings"), 1500);
    } catch (err) {
      showMessage(err.message || "Failed to update password.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── Theme styles ──────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const pageText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const inputBg = isWhiteTheme ? "bg-white" : "bg-zinc-800";
  const inputBorder = isWhiteTheme ? "border-gray-300" : "border-zinc-700";
  const mutedText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans ${pageBg} ${pageText}`}>
      <header className={`h-12 flex items-center px-6 border-b shrink-0 ${cardBg} ${borderColor}`}>
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className={`text-xs font-medium transition-colors ${mutedText} hover:text-current`}
        >
          ← Back
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wider select-none">
          Change Password
        </h1>
        <div className="w-12" />
      </header>

      <div className="flex-1 p-6 max-w-md mx-auto w-full">
        <div className={`p-6 rounded-xl border ${cardBg} ${borderColor} shadow-sm`}>
          {message.text && (
            <div
              className={`mb-4 p-3 rounded text-sm ${
                message.type === "error"
                  ? isWhiteTheme ? "bg-red-100 text-red-700" : "bg-red-900/30 text-red-300"
                  : isWhiteTheme ? "bg-green-100 text-green-700" : "bg-green-900/30 text-green-300"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg} ${inputBorder}`}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg} ${inputBorder}`}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg} ${inputBorder}`}
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;



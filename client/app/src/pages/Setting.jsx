import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Setting = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, refreshUser, subscribeUser, unsubscribeUser } = useAuth();
  const navigate = useNavigate();
  const isWhiteTheme = theme === "white";
  const isAuthenticated = user && user.role !== "guest";
  const isSubscribed = user?.subscribe === true;
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLogin = () => navigate("/login");
  const handleManageAccountClick = () => navigate("/manageaccount");

  const handleCancelSubscription = async () => {
    if (window.confirm("Are you sure you want to cancel your subscription?")) {
      setIsProcessing(true);
      try {
        await unsubscribeUser();
        // user state is updated via refreshUser inside unsubscribeUser
      } catch {
        // silent – error is handled inside the context
      } finally {
        setIsProcessing(false);
      }
    }
  };

  useEffect(() => {
    const checkSubscription = async () => {
      if (isAuthenticated) {
        await refreshUser();
      }
    };
    checkSubscription();
  }, [isAuthenticated, refreshUser]);

  const borderClass = isWhiteTheme ? "border-gray-200/80" : "border-zinc-700/50";
  const bgCardClass = isWhiteTheme ? "bg-gray-50/60 hover:bg-gray-100/60" : "bg-[#2b2d31] hover:bg-[#32353b]";
  const textMuted = isWhiteTheme ? "text-gray-500" : "text-gray-400";
  const actionBtnClass = isWhiteTheme
    ? "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm"
    : "bg-zinc-800 hover:bg-zinc-700 text-gray-200 border border-zinc-700/60 shadow-sm";

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-150 ${isWhiteTheme ? "bg-white text-gray-800" : "bg-[#1e1e24] text-gray-200"}`}>
      {/* Header */}
      <div className={`h-12 flex items-center px-6 border-b shrink-0 ${isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"}`}>
        <button
          type="button"
          onClick={() => navigate("/home")}
          className={`text-xs font-medium flex items-center gap-1 transition-colors focus:outline-none ${isWhiteTheme ? "text-gray-500 hover:text-gray-900" : "text-gray-400 hover:text-white"}`}
        >
          ← Back to Home
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wide select-none">Settings</h1>
        <div className="w-20" />
      </div>

      <div className="flex-1 p-6 max-w-md mx-auto w-full space-y-3">
        {/* Theme Toggle Card */}
        <div className={`p-4 rounded-lg border flex justify-between items-center transition-all ${bgCardClass} ${borderClass}`}>
          <div className="space-y-0.5 select-none pr-4">
            <h3 className="text-xs font-bold tracking-wide">Workspace Theme</h3>
            <p className={`text-[11px] leading-relaxed ${textMuted}`}>Switch between classic light and deep carbon dark interface configurations.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors focus:outline-none h-7 whitespace-nowrap min-w-[90px] ${actionBtnClass}`}
          >
            {isWhiteTheme ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
        </div>

        {/* Account Management Card */}
        <div
          onClick={handleManageAccountClick}
          className={`p-4 rounded-lg border flex justify-between items-center transition-all cursor-pointer group ${bgCardClass} ${borderClass}`}
        >
          <div className="space-y-0.5 select-none pr-4">
            <h3 className="text-xs font-bold tracking-wide">Account Identity</h3>
            <p className={`text-[11px] leading-relaxed ${textMuted}`}>Review deployment status vectors, active request channels, and live endpoints.</p>
          </div>
          <div className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors h-7 flex items-center justify-center whitespace-nowrap min-w-[90px] group-hover:border-blue-500/30 ${actionBtnClass}`}>
            Manage Account
          </div>
        </div>

        {/* Dashboard Card (NEW) */}
        <div
          onClick={() => navigate("/dashboard")}
          className={`p-4 rounded-lg border flex justify-between items-center transition-all cursor-pointer group ${bgCardClass} ${borderClass}`}
        >
          <div className="space-y-0.5 select-none pr-4">
            <h3 className="text-xs font-bold tracking-wide">📊 Dashboard</h3>
            <p className={`text-[11px] leading-relaxed ${textMuted}`}>Visualise real‑time API performance, latency trends, and request analytics.</p>
          </div>
          <div className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors h-7 flex items-center justify-center whitespace-nowrap min-w-[90px] group-hover:border-blue-500/30 ${actionBtnClass}`}>
            Open Dashboard
          </div>
        </div>

        {/* Tools Card (NEW) */}
        <div
          onClick={() => navigate("/tools")}
          className={`p-4 rounded-lg border flex justify-between items-center transition-all cursor-pointer group ${bgCardClass} ${borderClass}`}
        >
          <div className="space-y-0.5 select-none pr-4">
            <h3 className="text-xs font-bold tracking-wide">🛠️ Tools</h3>
            <p className={`text-[11px] leading-relaxed ${textMuted}`}>Access import utilities, network diagnostics, and advanced API builder.</p>
          </div>
          <div className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors h-7 flex items-center justify-center whitespace-nowrap min-w-[90px] group-hover:border-blue-500/30 ${actionBtnClass}`}>
            Launch Tools
          </div>
        </div>

        {/* Subscription Card */}
        <div className={`p-4 rounded-lg border flex justify-between items-center transition-all ${bgCardClass} ${borderClass}`}>
          <div className="space-y-0.5 select-none pr-4">
            <h3 className="text-xs font-bold tracking-wide">
              {!isAuthenticated ? "Session Status" : !isSubscribed ? "Premium Feature Access" : "Subscription Active"}
            </h3>
            <p className={`text-[11px] leading-relaxed ${textMuted}`}>
              {!isAuthenticated
                ? "Running workspace pipeline as an unauthenticated guest user environment."
                : !isSubscribed
                  ? `Signed in as @${user?.username || "user"}. Unlock unlimited API calls.`
                  : `Welcome back, @${user?.username || "user"}! Pro workspace access tiers are enabled.`}
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-[11px] font-semibold transition-colors focus:outline-none h-7 whitespace-nowrap min-w-[90px]"
              >
                Sign In
              </button>
            ) : (
              <>
                {!isSubscribed && (
                  <button
                    type="button"
                    onClick={() => navigate("/subscribe")}
                    disabled={isProcessing}
                    className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded text-[11px] font-semibold transition-colors focus:outline-none h-7 whitespace-nowrap min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Subscribe
                  </button>
                )}
                {isSubscribed && (
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={isProcessing}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors focus:outline-none h-7 whitespace-nowrap min-w-[90px] border disabled:opacity-50 disabled:cursor-not-allowed ${
                      isWhiteTheme
                        ? "border-gray-300 text-gray-700 hover:bg-gray-100"
                        : "border-zinc-700 text-gray-300 hover:bg-zinc-800"
                    }`}
                  >
                    {isProcessing ? "Processing..." : "Cancel Sub"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setting;
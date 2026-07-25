// src/pages/Setting.jsx
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
      } catch {
        // silent
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

  // ─── Theme‑aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const pageText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const headerBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const mutedText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const hoverText = isWhiteTheme ? "hover:text-gray-900" : "hover:text-white";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const cardHover = isWhiteTheme ? "hover:bg-gray-50" : "hover:bg-zinc-800/80";
  const cardShadow = isWhiteTheme ? "shadow-sm" : "shadow-sm shadow-black/10";
  const actionBtn = isWhiteTheme
    ? "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm"
    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 shadow-sm";
  const actionBtnHover = isWhiteTheme ? "group-hover:border-blue-400" : "group-hover:border-blue-500/30";

  return (
    <div
      className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${pageBg} ${pageText}`}
    >
      {/* ─── Header ─── */}
      <header
        className={`h-12 flex items-center px-6 border-b shrink-0 ${headerBg} ${borderColor}`}
      >
        <button
          type="button"
          onClick={() => navigate("/home")}
          className={`
            flex items-center gap-2 text-xs font-medium transition-all duration-200
            ${isWhiteTheme ? "text-gray-500 hover:text-gray-900" : "text-zinc-400 hover:text-white"}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1
            ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          `}
          aria-label="Go back to Home"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back</span>
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wider select-none">
          Settings
        </h1>
        <div className="w-20" />
      </header>

      {/* ─── Main content ─── */}
      <div className="flex-1 p-6 max-w-lg mx-auto w-full space-y-4">
        {/* Theme Toggle */}
        <div
          className={`
            p-4 rounded-xl border transition-all duration-200
            ${cardBg} ${borderColor} ${cardShadow} ${cardHover}
            flex items-center justify-between gap-4
          `}
        >
          <div className="space-y-0.5 select-none min-w-0 flex-1">
            <h3 className="text-xs font-semibold tracking-wide">Workspace Theme</h3>
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              Switch between light and dark interface configurations.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              ${actionBtn}
              whitespace-nowrap shrink-0
            `}
          >
            {isWhiteTheme ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
        </div>

        {/* Account Identity */}
        <div
          onClick={handleManageAccountClick}
          className={`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${cardBg} ${borderColor} ${cardShadow} ${cardHover}
            flex items-center justify-between gap-4
          `}
        >
          <div className="space-y-0.5 select-none min-w-0 flex-1">
            <h3 className="text-xs font-semibold tracking-wide">Account Identity</h3>
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              Manage your account settings, permissions, and active sessions.
            </p>
          </div>
          <div
            className={`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${actionBtn} ${actionBtnHover}
              whitespace-nowrap shrink-0
            `}
          >
            Manage
          </div>
        </div>

        {/* Dashboard */}
        <div
          onClick={() => navigate("/dashboard")}
          className={`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${cardBg} ${borderColor} ${cardShadow} ${cardHover}
            flex items-center justify-between gap-4
          `}
        >
          <div className="space-y-0.5 select-none min-w-0 flex-1">
            <h3 className="text-xs font-semibold tracking-wide">📊 Dashboard</h3>
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              Visualise real‑time API performance, latency trends, and request analytics.
            </p>
          </div>
          <div
            className={`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${actionBtn} ${actionBtnHover}
              whitespace-nowrap shrink-0
            `}
          >
            Open
          </div>
        </div>

        {/* Tools */}
        <div
          onClick={() => navigate("/tools")}
          className={`
            p-4 rounded-xl border transition-all duration-200 cursor-pointer group
            ${cardBg} ${borderColor} ${cardShadow} ${cardHover}
            flex items-center justify-between gap-4
          `}
        >
          <div className="space-y-0.5 select-none min-w-0 flex-1">
            <h3 className="text-xs font-semibold tracking-wide">🛠️ Tools</h3>
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              Access import utilities, network diagnostics, and the advanced API builder.
            </p>
          </div>
          <div
            className={`
              px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
              ${actionBtn} ${actionBtnHover}
              whitespace-nowrap shrink-0
            `}
          >
            Launch
          </div>
        </div>

        {/* Subscription / Session */}
        <div
          className={`
            p-4 rounded-xl border transition-all duration-200
            ${cardBg} ${borderColor} ${cardShadow} ${cardHover}
            flex items-center justify-between gap-4
          `}
        >
          <div className="space-y-0.5 select-none min-w-0 flex-1">
            <h3 className="text-xs font-semibold tracking-wide">
              {!isAuthenticated
                ? "Session Status"
                : !isSubscribed
                ? "Premium Access"
                : "Subscription Active"}
            </h3>
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              {!isAuthenticated
                ? "You are browsing as a guest. Sign in to unlock full features."
                : !isSubscribed
                ? `Signed in as @${user?.username || "user"}. Subscribe for unlimited access.`
                : `Welcome back, @${user?.username || "user"}! Pro features are enabled.`}
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogin}
                className={`
                  px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                  bg-blue-600 hover:bg-blue-500 text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
                  whitespace-nowrap
                `}
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
                    className={`
                      px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                      bg-rose-600 hover:bg-rose-500 text-white
                      focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
                      ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
                      whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    Subscribe
                  </button>
                )}
                {isSubscribed && (
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={isProcessing}
                    className={`
                      px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200
                      ${actionBtn}
                      focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
                      ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
                      whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {isProcessing ? "Processing..." : "Cancel"}
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
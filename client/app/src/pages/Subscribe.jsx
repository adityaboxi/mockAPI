// src/pages/Subscribe.jsx
import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Subscribe() {
  const { theme } = useTheme();
  const { subscribeUser } = useAuth();
  const navigate = useNavigate();
  const isWhiteTheme = theme === "white";
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    const result = await subscribeUser();
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/setting");
      }, 1500);
    }
    setLoading(false);
  };

  // ─── Theme‑aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const pageText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const headerBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const mutedText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const hoverText = isWhiteTheme ? "hover:text-gray-900" : "hover:text-white";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const cardShadow = isWhiteTheme ? "shadow-lg" : "shadow-xl shadow-black/20";
  const featureText = isWhiteTheme ? "text-gray-700" : "text-zinc-300";
  const dividerLine = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";
  const buttonSuccess = "bg-emerald-600 text-white";

  const features = [
    "Unlimited API Route Blueprints",
    "Real-time Collaboration Request Syncing",
    "High-Concurrency Performance Buffering",
    "Custom Response Header Compilation",
    "Advanced Session State Cookies Management",
  ];

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
          onClick={() => navigate("/setting")}
          className={`
            flex items-center gap-2 text-xs font-medium transition-all duration-200
            ${isWhiteTheme ? "text-gray-500 hover:text-gray-900" : "text-zinc-400 hover:text-white"}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1
            ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          `}
          aria-label="Go back to Settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back</span>
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wider select-none">
          Subscribe
        </h1>
        <div className="w-20" />
      </header>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md mx-auto space-y-2 select-none mb-8">
          <span className="text-[10px] uppercase font-bold tracking-widest text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full">
            Premium Access Tiers
          </span>
          <h1 className={`text-2xl font-bold tracking-tight ${isWhiteTheme ? "text-gray-800" : "text-white"}`}>
            Upgrade Your Workspace
          </h1>
          <p className={`text-xs leading-relaxed ${mutedText}`}>
            Eliminate compilation boundaries, scale deep mock environments, and seamlessly deploy active backend traces.
          </p>
        </div>

        <div
          className={`w-full max-w-sm rounded-2xl p-6 shadow-md border flex flex-col gap-5 transition-all duration-200 ${cardBg} ${borderColor} ${cardShadow}`}
        >
          <div className="space-y-1 select-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Pro Developer Plan
              </span>
              <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                Popular
              </span>
            </div>
            <div className="flex items-baseline gap-1 pt-1">
              <span className={`text-3xl font-extrabold tracking-tight ${isWhiteTheme ? "text-gray-800" : "text-white"}`}>
                $9
              </span>
              <span className={`text-xs font-medium ${mutedText}`}>/ month</span>
            </div>
            <p className={`text-[11px] ${mutedText}`}>Full cloud dashboard management suite entitlements.</p>
          </div>

          <hr className={dividerLine} />

          <div className="space-y-2.5">
            <h4 className={`text-[11px] font-bold tracking-wider uppercase select-none ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"}`}>
              Includes Entitlements:
            </h4>
            <ul className="space-y-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs">
                  <span className="text-blue-500 font-bold text-sm leading-none select-none">✓</span>
                  <span className={featureText}>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <hr className={dividerLine} />

          <button
            type="button"
            disabled={loading || success}
            onClick={handleSubscribe}
            className={`
              w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide text-white transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              select-none
              ${
                loading
                  ? "bg-zinc-700 cursor-not-allowed opacity-75"
                  : success
                  ? `${buttonSuccess} cursor-default`
                  : `${buttonPrimary} active:scale-[0.98]`
              }
            `}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white rounded-full border-t-transparent animate-spin" />
                <span>Processing API Stream...</span>
              </div>
            ) : success ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Subscribed!</span>
              </div>
            ) : (
              "Upgrade to Pro Tier ✦"
            )}
          </button>

          <p className={`text-[10px] text-center italic select-none ${mutedText}`}>
            Secure Stripe billing. Pause or terminate your active plan anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Subscribe;
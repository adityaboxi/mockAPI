
import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Subscribe() {
  const { theme } = useTheme();
  const { subscribeUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isWhite = theme === "white";
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
   
      const result = await subscribeUser();
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/settings");
        }, 1500);
      }
    } catch (error) {
      } finally {
      setLoading(false);
    }
  };

   const mainWrapperBg = isWhite ? "bg-white text-gray-800" : "bg-[#1e1f22] text-[#e2e8f0]";
  const cardBg = isWhite ? "bg-gray-50 border border-gray-200" : "bg-[#2b2d31] border border-zinc-700/50";
  const headerTxt = isWhite ? "text-gray-900" : "text-white";
  const mutedTxt = isWhite ? "text-gray-500" : "text-gray-400";
  const dividerLine = isWhite ? "border-gray-200" : "border-zinc-700/50";

  const features = [
    "Unlimited API Route Blueprints",
    "Real-time Collaboration Request Syncing",
    "High-Concurrency Performance Buffering",
    "Custom Response Header Compilation",
    "Advanced Session State Cookies Management",
  ];

  return (
    <div className={`w-full min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-150 ${mainWrapperBg}`}>
      <div className="text-center max-w-md mx-auto space-y-2 select-none mb-8">
        <span className="text-[10px] uppercase font-bold tracking-widest text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full">
          Premium Access Tiers
        </span>
        <h1 className={`text-2xl font-bold tracking-tight ${headerTxt}`}>Upgrade Your Workspace</h1>
        <p className={`text-xs leading-relaxed ${mutedTxt}`}>
          Eliminate compilation boundaries, scale deep mock environments, and seamlessly deploy active backend traces.
        </p>
      </div>

      <div className={`w-full max-w-sm rounded-xl p-6 shadow-md flex flex-col gap-5 ${cardBg}`}>
        <div className="space-y-1 select-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Pro Developer Plan</span>
            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Popular</span>
          </div>
          <div className="flex items-baseline gap-1 pt-1">
            <span className={`text-3xl font-extrabold tracking-tight ${headerTxt}`}>$9</span>
            <span className={`text-xs font-medium ${mutedTxt}`}>/ month</span>
          </div>
          <p className={`text-[11px] ${mutedTxt}`}>Full cloud dashboard management suite entitlements.</p>
        </div>

        <hr className={dividerLine} />

        <div className="space-y-2.5">
          <h4 className={`text-[11px] font-bold tracking-wider uppercase select-none ${isWhite ? "text-gray-400" : "text-zinc-500"}`}>
            Includes Entitlements:
          </h4>
          <ul className="space-y-2">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs">
                <span className="text-blue-500 font-bold text-sm leading-none select-none">✓</span>
                <span className={isWhite ? "text-gray-600" : "text-gray-300"}>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <hr className={dividerLine} />

        <button
          type="button"
          disabled={loading || success}
          onClick={handleSubscribe}
          className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide text-white transition-all shadow-sm focus:outline-none select-none ${
            loading
              ? "bg-zinc-600 cursor-not-allowed opacity-75"
              : success
              ? "bg-emerald-600 cursor-default"
              : "bg-blue-600 hover:bg-blue-500 active:scale-[0.99]"
          }`}
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

        <p className={`text-[10px] text-center italic select-none ${mutedTxt}`}>
          Secure Stripe billing. Pause or terminate your active plan anytime.
        </p>
      </div>
    </div>
  );
}

export default Subscribe;
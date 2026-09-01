// src/pages/Subscribe.jsx
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";

function Subscribe() {
  const { theme } = useTheme();
  const { user, subscribeUser, unsubscribeUser } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const navigate = useNavigate();
  const isWhiteTheme = theme === "white";
  const [loading, setLoading] = useState(false);
  const redirectTimerRef = useRef(null);

  const isAuthenticated = user && user.role !== "guest";
  const isSubscribed = user?.subscribe === true;

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleToggleSubscribe = async () => {
    if (!isAuthenticated) {
      showWarning("Please sign in or create an account to manage Pro plans.");
      navigate("/login");
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      if (isSubscribed) {
        const result = await unsubscribeUser();
        if (result.success) {
          showSuccess("Subscription downgraded to Free Tier.");
        } else {
          showError(result.error || "Failed to modify subscription");
        }
      } else {
        const result = await subscribeUser();
        if (result.success) {
          showSuccess("✨ Upgraded to Pro Plan (Simulated)!");
          redirectTimerRef.current = setTimeout(() => navigate("/home"), 1200);
        } else {
          showError(result.error || "Subscription upgrade failed");
        }
      }
    } catch (err) {
      showError(err.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  // ─── Theme-aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-[#f8fafc]" : "bg-[#09090b]";
  const pageText = isWhiteTheme ? "text-slate-800" : "text-zinc-200";
  const headerBg = isWhiteTheme ? "bg-white/80 border-slate-200/80 backdrop-blur-md" : "bg-[#0c0c0e]/80 border-zinc-800/60 backdrop-blur-md";
  const borderColor = isWhiteTheme ? "border-slate-200" : "border-zinc-800";
  const mutedText = isWhiteTheme ? "text-slate-500" : "text-zinc-400";
  const cardBg = isWhiteTheme ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800";
  const badgeFreeBg = isWhiteTheme ? "bg-slate-100 text-slate-700" : "bg-zinc-800 text-zinc-300";
  const checkText = isWhiteTheme ? "text-slate-600" : "text-zinc-400";

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${pageBg} ${pageText}`}>
      {/* Header */}
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
          Subscription & Plans
        </h1>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col items-center justify-center space-y-8">
        <div className="text-center max-w-lg mx-auto space-y-2 select-none">
          <span className="text-[10px] uppercase font-bold tracking-widest text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            Developer Access Tiers
          </span>
          <h1 className={`text-3xl font-extrabold tracking-tight ${isWhiteTheme ? "text-slate-900" : "text-white"}`}>
            Scale Your API Workflow
          </h1>
          <p className={`text-xs leading-relaxed ${mutedText}`}>
            Supercharge your mock backends with expanded workspaces, high-throughput container clusters, and unlimited AI schema generation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Free Tier Card */}
          <div className={`p-6 rounded-2xl border ${cardBg} flex flex-col justify-between space-y-6 shadow-sm`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Free Tier</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${badgeFreeBg}`}>
                  {!isSubscribed ? "Active Plan" : "Default"}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">$0</span>
                <span className={`text-xs ${mutedText}`}>/ forever</span>
              </div>
              <ul className={`space-y-2.5 text-xs ${checkText}`}>
                <li className="flex items-center gap-2">✓ 2 Collaborative Workspaces</li>
                <li className="flex items-center gap-2">✓ 5 Endpoints per Workspace</li>
                <li className="flex items-center gap-2">✓ 5 Versions per Endpoint</li>
                <li className="flex items-center gap-2">✓ Basic AI Blueprint Prompts</li>
              </ul>
            </div>
            <button
              disabled
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold ${
                isWhiteTheme ? "bg-slate-100 text-slate-400" : "bg-zinc-800 text-zinc-500"
              } cursor-not-allowed`}
            >
              Default Plan
            </button>
          </div>

          {/* Pro Tier Card */}
          <div
            className={`p-6 rounded-2xl border-2 ${
              isSubscribed ? "border-emerald-500 shadow-emerald-500/10" : "border-blue-500 shadow-blue-500/10"
            } ${cardBg} flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-[9px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
              {isSubscribed ? "Active Plan" : "Recommended"}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Pro Developer</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">$0</span>
                <span className={`text-xs ${mutedText}`}>/ simulated</span>
              </div>
              <ul className={`space-y-2.5 text-xs font-medium ${isWhiteTheme ? "text-slate-700" : "text-zinc-300"}`}>
                <li className="flex items-center gap-2 text-emerald-500">✓ 5 Workspaces (Full Team Isolation)</li>
                <li className="flex items-center gap-2 text-emerald-500">✓ 30 Dynamic Endpoints per Workspace</li>
                <li className="flex items-center gap-2 text-emerald-500">✓ 20 Versions with Instant Rollback</li>
                <li className="flex items-center gap-2 text-emerald-500">✓ Unlimited AI Generation (Llama-3.3)</li>
                <li className="flex items-center gap-2 text-emerald-500">✓ High-Priority Mock Container Pool</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleToggleSubscribe}
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                isSubscribed
                  ? isWhiteTheme
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                "Processing..."
              ) : isSubscribed ? (
                "Downgrade to Free"
              ) : (
                "✨ Upgrade to Pro (Simulate 1-Click)"
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default React.memo(Subscribe);
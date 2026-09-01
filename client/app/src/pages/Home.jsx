// src/pages/Home.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useTheme } from "../context/ThemeContext";
import ProjectList from "../components/ProjectList/ProjectList";
import MainContent from "../components/MainContent";
import ApiHistory from "../components/ApiHistory";
import ApiLog from "../components/ApiLog";
import Footer from "../components/Footer";

function Home() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { clearProject, selectProject, currentProject } = useProject();

  // ---- Sidebar toggles (persisted in localStorage) ----
  const [isProjectListOpen, setIsProjectListOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("isProjectListOpen");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isApiHistoryOpen, setIsApiHistoryOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("isApiHistoryOpen");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isApiLogOpen, setIsApiLogOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("isApiLogOpen");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const currentProjectName = currentProject?.name || "No Workspace Selected";
  const currentProjectId = currentProject?.id || "";
  const isWhiteTheme = theme === "white";

  // ---- Persist toggles ----
  useEffect(() => {
    try {
      localStorage.setItem("isProjectListOpen", JSON.stringify(isProjectListOpen));
    } catch { /* ignore */ }
  }, [isProjectListOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("isApiHistoryOpen", JSON.stringify(isApiHistoryOpen));
    } catch { /* ignore */ }
  }, [isApiHistoryOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("isApiLogOpen", JSON.stringify(isApiLogOpen));
    } catch { /* ignore */ }
  }, [isApiLogOpen]);

  // ---- Memoized Handlers ----
  const toggleProjectList = useCallback(() => setIsProjectListOpen((prev) => !prev), []);
  const toggleApiHistory = useCallback(() => setIsApiHistoryOpen((prev) => !prev), []);
  const toggleApiLog = useCallback(() => setIsApiLogOpen((prev) => !prev), []);

  const handleProjectSelect = useCallback((project) => {
    if (project) {
      selectProject(project.projectname, project.id, project.invitationCode);
    }
  }, [selectProject]);

  const handleLogout = useCallback(async () => {
    clearProject();
    await logout();
    navigate("/login");
  }, [clearProject, logout, navigate]);

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }, []);

  const displayName = user?.username || "Guest";
  const userRole = user?.role || "guest";
  const isPro = user?.subscribe === true;

  // ─── Theme-aware design tokens ────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-[#f8fafc]" : "bg-[#09090b]";
  const pageText = isWhiteTheme ? "text-slate-800" : "text-zinc-200";
  const headerBg = isWhiteTheme
    ? "bg-white/80 border-slate-200/80 backdrop-blur-md"
    : "bg-[#0c0c0e]/80 border-zinc-800/60 backdrop-blur-md";
  const borderColor = isWhiteTheme ? "border-slate-200/80" : "border-zinc-800/60";
  const mutedText = isWhiteTheme ? "text-slate-500" : "text-zinc-400";
  const hoverText = isWhiteTheme ? "hover:text-slate-900" : "hover:text-white";
  const pillBg = isWhiteTheme
    ? "bg-slate-100 border border-slate-200 hover:bg-slate-200/70"
    : "bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800";

  return (
    <div
      className={`h-screen w-full font-sans flex flex-col overflow-hidden selection:bg-blue-500/30 transition-colors duration-200 ${pageBg} ${pageText}`}
    >
      {/* ─── Golden Ratio Top Navigation Bar (52px) ─── */}
      <header
        className={`h-[52px] shrink-0 flex items-center justify-between px-4 md:px-6 border-b ${headerBg} transition-colors duration-200 z-20 shadow-sm`}
      >
        {/* Left Section: Branding & Workspaces Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20">
              ⚡
            </div>
            <span className="text-xs font-bold tracking-tight hidden sm:inline bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">
              MockAPI
            </span>
          </div>

          <div className={`w-px h-4 ${isWhiteTheme ? "bg-slate-200" : "bg-zinc-800"}`} />

          <button
            type="button"
            onClick={toggleProjectList}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${pillBg} ${mutedText} ${hoverText}`}
            aria-label="Toggle workspaces drawer"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isProjectListOpen ? "rotate-0 text-blue-500" : "-rotate-90"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-[11px] font-semibold tracking-wide">Workspaces</span>
          </button>
        </div>

        {/* Center Section: Active Workspace Breadcrumb */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium border shadow-xs max-w-xs md:max-w-md truncate ${
              isWhiteTheme
                ? "bg-white border-slate-200/90 text-slate-800"
                : "bg-zinc-900/90 border-zinc-800 text-zinc-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${currentProjectId ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
            <span className="truncate text-[11px] font-semibold tracking-wide">
              {currentProjectName}
            </span>
          </div>
        </div>

        {/* Right Section: Fast Actions, Theme Toggle, History, User Menu */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Quick Command Palette Trigger (Cmd+K) */}
          <button
            type="button"
            onClick={openCommandPalette}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${pillBg} ${mutedText}`}
            title="Press Cmd+K / Ctrl+K to open Command Palette"
          >
            <span>⌘K</span>
            <span className="text-[10px] opacity-70">Search</span>
          </button>

          {/* Tools Navigation */}
          <button
            type="button"
            onClick={() => navigate("/tools")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${pillBg} ${mutedText} ${hoverText}`}
          >
            Tools
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg transition-all ${pillBg} ${mutedText} ${hoverText}`}
            aria-label="Toggle color theme"
            title={isWhiteTheme ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {isWhiteTheme ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          {/* History Drawer Toggle */}
          <button
            type="button"
            onClick={toggleApiHistory}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${pillBg} ${mutedText} ${hoverText}`}
            aria-label="Toggle history panel"
          >
            <span>History</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isApiHistoryOpen ? "rotate-0 text-blue-500" : "rotate-90"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Real-time Socket API Telemetry Stream */}
          <button
            type="button"
            onClick={toggleApiLog}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${pillBg} ${mutedText} ${hoverText}`}
            aria-label="Toggle logs panel"
          >
            <span>Logs</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isApiLogOpen ? "rotate-0 text-emerald-400" : "rotate-90"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className={`w-px h-4 ${isWhiteTheme ? "bg-slate-200" : "bg-zinc-800"}`} />

          {/* User Account / Auth Status */}
          <button
            type="button"
            onClick={() => navigate("/manageaccount")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${pillBg}`}
            title="Manage Account Settings"
          >
            <span className={`font-semibold text-[11px] truncate max-w-[90px] ${isWhiteTheme ? "text-slate-700" : "text-zinc-200"}`}>
              {displayName}
            </span>
            {isPro && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-black">
                PRO
              </span>
            )}
          </button>

          {userRole === "guest" ? (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            >
              Login
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${mutedText} hover:text-rose-400`}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ─── Work Canvas ─── */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Workspaces Drawer (260px) */}
        <aside
          className={`transition-all duration-300 ease-in-out overflow-hidden flex shrink-0 border-r ${borderColor} ${
            isProjectListOpen ? "w-64" : "w-0 border-r-0"
          }`}
        >
          <ProjectList user={user} onProjectSelect={handleProjectSelect} theme={theme} />
        </aside>

        {/* Center Main API Studio */}
        <main className="flex-1 flex min-w-0 h-full overflow-hidden">
          <MainContent projectId={currentProjectId} />
        </main>

        {/* Right API Version History Panel (320px) */}
        <ApiHistory isApiHistoryOpen={isApiHistoryOpen} projectId={currentProjectId} />

        {/* Real-time Socket API Telemetry Stream */}
        <aside
          className={`transition-all duration-300 ease-in-out overflow-hidden flex shrink-0 border-l ${borderColor} ${
            isApiLogOpen ? "w-56" : "w-0 border-l-0"
          }`}
        >
          <ApiLog projectId={currentProjectId} />
        </aside>
      </div>

      <Footer />
    </div>
  );
}

export default React.memo(Home);
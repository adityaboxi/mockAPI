// src/pages/Home.jsx
import React, { useState, useEffect } from "react";
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
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { clearProject, selectProject, currentProject, projects, fetchProjects } = useProject();

  // ---- Sidebar toggles (persisted in localStorage) ----
  const [isProjectListOpen, setIsProjectListOpen] = useState(() => {
    const saved = localStorage.getItem("isProjectListOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isApiHistoryOpen, setIsApiHistoryOpen] = useState(() => {
    const saved = localStorage.getItem("isApiHistoryOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const currentProjectName = currentProject?.name || "No Project";
  const currentProjectId = currentProject?.id || "";
  const isWhiteTheme = theme === "white";

  // ---- Persist toggles ----
  useEffect(() => {
    localStorage.setItem("isProjectListOpen", JSON.stringify(isProjectListOpen));
  }, [isProjectListOpen]);

  useEffect(() => {
    localStorage.setItem("isApiHistoryOpen", JSON.stringify(isApiHistoryOpen));
  }, [isApiHistoryOpen]);

  // ---- Auto‑select first project on login ----
  useEffect(() => {
    const autoSelectFirstProject = async () => {
      if (!user) return;
      if (currentProject) return;

      if (projects && projects.length > 0) {
        const first = projects[0];
        selectProject(first.projectname, first.id, first.invitationCode);
        return;
      }

      if (fetchProjects) {
        try {
          const fetched = await fetchProjects();
          if (fetched && fetched.length > 0) {
            const first = fetched[0];
            selectProject(first.projectname, first.id, first.invitationCode);
          }
        } catch (err) {
          console.error("[Home] Failed to auto‑select project:", err);
        }
      }
    };

    autoSelectFirstProject();
  }, [user, projects, currentProject, selectProject, fetchProjects]);

  // ---- Handlers ----
  const toggleProjectList = () => setIsProjectListOpen((prev) => !prev);
  const toggleApiHistory = () => setIsApiHistoryOpen((prev) => !prev);

  const handleProjectSelect = (project) => {
    selectProject(project.projectname, project.id, project.invitationCode);
  };

  const handleLogout = async () => {
    localStorage.removeItem("isProjectListOpen");
    localStorage.removeItem("isApiHistoryOpen");
    clearProject();
    await logout();
    navigate("/login");
  };

  const handleNavigateToLogin = () => navigate("/login");

  const displayName = user?.username || "Guest";
  const userRole = user?.role || "guest";

  // ─── Theme‑aware styles ──────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const pageText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const headerBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const mutedText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";
  const hoverText = isWhiteTheme ? "hover:text-gray-800" : "hover:text-white";
  const buttonPrimary = "bg-blue-600 hover:bg-blue-500 text-white";

  // ─── Header ──────────────────────────────────────────────────
  const Header = () => (
    <header
      className={`h-12 shrink-0 flex items-center px-5 border-b ${headerBg} ${borderColor} transition-colors duration-200`}
    >
      {/* Left: Project toggle */}
      <div className="flex items-center gap-6 w-1/3">
        <button
          onClick={toggleProjectList}
          className={`flex items-center gap-2 text-xs font-medium transition-all duration-200 ${mutedText} ${hoverText} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 ${
            isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
          }`}
          aria-label={isProjectListOpen ? "Collapse project list" : "Expand project list"}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isProjectListOpen ? "rotate-0" : "-rotate-90"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span>Projects</span>
        </button>
        <div className={`w-px h-5 ${isWhiteTheme ? "bg-gray-200" : "bg-zinc-700"}`} />
        <span className={`text-xs ${mutedText}`}>
          {isProjectListOpen ? `${projects?.length || 0} workspaces` : ""}
        </span>
      </div>

      {/* Center: Project name */}
      <div
        className={`w-1/3 text-center text-sm font-semibold truncate ${
          isWhiteTheme ? "text-gray-700" : "text-white"
        }`}
      >
        {currentProjectName}
      </div>

      {/* Right: User info + History toggle + Auth buttons */}
      <div className="w-1/3 flex justify-end items-center gap-4 text-xs">
        <button
          onClick={toggleApiHistory}
          className={`flex items-center gap-2 text-xs font-medium transition-all duration-200 ${mutedText} ${hoverText} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 ${
            isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
          }`}
          aria-label={isApiHistoryOpen ? "Collapse API history" : "Expand API history"}
        >
          <span>History</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isApiHistoryOpen ? "rotate-0" : "rotate-90"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className={`w-px h-5 ${isWhiteTheme ? "bg-gray-200" : "bg-zinc-700"}`} />

        <span className={`font-medium ${mutedText}`}>{displayName}</span>

        {userRole === "guest" ? (
          <button
            onClick={handleNavigateToLogin}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${buttonPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
            }`}
          >
            Login
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${buttonPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"
            }`}
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );

  // ─── Main render ─────────────────────────────────────────────
  return (
    <div
      className={`h-screen w-full font-sans flex flex-col overflow-hidden selection:bg-blue-500/30 transition-colors duration-200 ${pageBg} ${pageText}`}
    >
      <Header />
      <div className="flex-1 flex min-h-0">
        {isProjectListOpen && (
          <ProjectList user={user} onProjectSelect={handleProjectSelect} theme={theme} />
        )}
        <MainContent projectId={currentProjectId} />
        <ApiHistory isApiHistoryOpen={isApiHistoryOpen} projectId={currentProjectId} />
        <ApiLog projectId={currentProjectId} />
      </div>
      <Footer />
    </div>
  );
}

export default Home;
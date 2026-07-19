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
      if (!user) return;                     // not logged in
      if (currentProject) return;            // already selected

      // If we have projects in context, use the first one
      if (projects && projects.length > 0) {
        const first = projects[0];
        selectProject(first.projectname, first.id, first.invitationCode);
        return;
      }

      // Otherwise, fetch projects if context provides a fetch function
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

  // ---- Header (unchanged) ----
  const Header = () => (
    <div
      className={`h-10 shrink-0 flex items-center px-4 border-b justify-between ${
        isWhiteTheme
          ? "bg-white border-gray-200"
          : "bg-zinc-950 border-zinc-800"
      }`}
    >
      <div className="flex items-center gap-6 w-1/3">
        <button
          onClick={toggleProjectList}
          className={`transition-colors text-xs flex items-center gap-2 ${
            isWhiteTheme
              ? "text-gray-500 hover:text-gray-700"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          projects {isProjectListOpen ? "<<" : ">>"}
        </button>
      </div>

      <div
        className={`w-1/3 text-center text-xs font-semibold truncate ${
          isWhiteTheme ? "text-gray-700" : "text-white"
        }`}
      >
        {currentProjectName}
      </div>

      <div className="w-1/3 flex justify-end items-center gap-4 text-xs">
        <button
          onClick={toggleApiHistory}
          className={`transition-colors flex items-center gap-1 ${
            isWhiteTheme
              ? "text-gray-500 hover:text-gray-700"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          API History {isApiHistoryOpen ? ">>" : "<<"}
        </button>

        <span className={`font-medium ${isWhiteTheme ? "text-gray-500" : "text-zinc-400"}`}>
          {displayName}
        </span>

        {userRole === "guest" ? (
          <button
            onClick={handleNavigateToLogin}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
          >
            Login
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );

  // ---- Main render ----
  return (
    <div
      className={`h-screen w-full font-sans flex flex-col overflow-hidden text-sm selection:bg-blue-500/30 ${
        isWhiteTheme ? "bg-white text-gray-800" : "bg-zinc-950 text-zinc-300"
      }`}
    >
      <Header />
      <div className="flex-1 flex min-h-0">
        {isProjectListOpen && (
          <ProjectList user={user} onProjectSelect={handleProjectSelect} theme={theme} />
        )}
        {/* ✅ Pass projectId to all child components that need it */}
        <MainContent projectId={currentProjectId} />
        <ApiHistory isApiHistoryOpen={isApiHistoryOpen} projectId={currentProjectId} />
        <ApiLog projectId={currentProjectId} />
      </div>
      <Footer />
    </div>
  );
}

export default Home;


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
  
 
  const { clearProject, selectProject, currentProject } = useProject();

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

   useEffect(() => {
    localStorage.setItem("isProjectListOpen", JSON.stringify(isProjectListOpen));
  }, [isProjectListOpen]);

  useEffect(() => {
    localStorage.setItem("isApiHistoryOpen", JSON.stringify(isApiHistoryOpen));
  }, [isApiHistoryOpen]);

  // Toggle functions
  const toggleProjectList = () => setIsProjectListOpen((prev) => !prev);
  const toggleApiHistory = () => setIsApiHistoryOpen((prev) => !prev);

  // When a project is selected from the sidebar
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

  
  const Header = () => (
    <div
      className={`h-10 shrink-0 flex items-center px-4 border-b justify-between ${
        isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"
      }`}
    >
      <div className="flex items-center gap-6 w-1/3">
        <button
          onClick={toggleProjectList}
          className={`transition-colors text-xs flex items-center gap-2 ${
            isWhiteTheme ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-white"
          }`}
        >
          projects {isProjectListOpen ? "<<" : ">>"}
        </button>
      </div>

      <div
        className={`w-1/3 text-center text-xs font-semibold truncate ${
          isWhiteTheme ? "text-gray-700" : "text-gray-300"
        }`}
      >

        {currentProjectName}
      </div>

      <div className="w-1/3 flex justify-end items-center gap-4 text-xs">
        <button
          onClick={toggleApiHistory}
          className={`transition-colors flex items-center gap-1 ${
            isWhiteTheme ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-white"
          }`}
        >
          API History {isApiHistoryOpen ? ">>" : "<<"}
        </button>

        <span className={`font-medium ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>
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
            className={`px-3 py-1 rounded transition-colors ${
              isWhiteTheme
                ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                : "bg-zinc-700 hover:bg-zinc-600 text-white"
            }`}
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`h-screen w-full font-sans flex flex-col overflow-hidden text-sm selection:bg-blue-500/30 ${
        isWhiteTheme ? "bg-white text-gray-800" : "bg-[#1e1e24] text-gray-300"
      }`}
    >
      <Header />
      <div className="flex-1 flex min-h-0">
        {isProjectListOpen && (
          <ProjectList user={user} onProjectSelect={handleProjectSelect} theme={theme} />
        )}
        <MainContent />
        <ApiHistory isApiHistoryOpen={isApiHistoryOpen} projectId={currentProjectId} />
        <ApiLog />
      </div>
      <Footer />
    </div>
  );
}

export default Home;
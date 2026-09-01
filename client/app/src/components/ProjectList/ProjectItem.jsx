import React, { useState, useCallback, useMemo, memo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useProject } from "../../context/ProjectContext";
import { useTheme } from "../../context/ThemeContext";
import ProjectDetailsModal from "./ProjectDetailsModal";

function ProjectItem({ project, isSelected, onClick, onStatusChange, onProjectUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const { selectProject } = useProject();
  const { theme } = useTheme();

  const isWhiteTheme = theme === "white";

  // Memoize derived values
  const isCreator = useMemo(
    () => user?.username === project.username,
    [user?.username, project.username]
  );

  // Stable event handlers
  const handleProjectClick = useCallback(async () => {
    await selectProject(project.projectname, project.id);
    if (onClick) onClick(project);
  }, [selectProject, project, onClick]);

  const handleSettingsClick = useCallback((e) => {
    e.stopPropagation();
    setShowModal(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleStatusChange = useCallback(
    (stat) => {
      onStatusChange(project.id, stat);
    },
    [onStatusChange, project.id]
  );

  const handleInvitationUpdate = useCallback(
    (id, code) => {
      onProjectUpdate(id, { invitationCode: code });
    },
    [onProjectUpdate]
  );

  // Memoize the status text and color class
  const statusText = project.isActive !== false ? "Active" : "Inactive";
  const statusDot = project.isActive !== false ? "bg-emerald-400" : "bg-amber-500";
  const statusClass = project.isActive !== false ? "text-emerald-400" : "text-amber-500";

  // ─── Theme-aware styles ─────────────────────────────────────────
  const baseClasses = `
    flex flex-col py-3 px-3.5 cursor-pointer border-b transition-all duration-200 select-none
    ${isWhiteTheme ? "border-gray-100" : "border-zinc-800/60"}
  `;

  const selectedClasses = isSelected
    ? isWhiteTheme
      ? "bg-blue-50 border-l-2 border-l-blue-500 text-gray-800"
      : "bg-blue-950/30 border-l-2 border-l-blue-500 text-zinc-200"
    : isWhiteTheme
      ? "hover:bg-gray-50 text-gray-700"
      : "hover:bg-zinc-900/60 text-zinc-400";

  const containerClasses = `${baseClasses} ${selectedClasses}`;

  return (
    <>
      <div onClick={handleProjectClick} className={containerClasses}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm truncate max-w-[75%] tracking-wide">
            {project.projectname}
          </span>
          {isCreator && (
            <button
              onClick={handleSettingsClick}
              className={`
                flex items-center justify-center w-6 h-6 rounded
                transition-all duration-200
                ${isWhiteTheme
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
                }
                hover:scale-105 active:scale-95
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              `}
              aria-label="Project settings"
            >
              <span className="text-xs font-bold leading-none">⋯</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot} flex-shrink-0`} />
          <span className={`text-[10px] font-mono uppercase tracking-wider ${statusClass}`}>
            {statusText}
          </span>
          {!isCreator && (
            <span className="text-[9px] font-mono text-zinc-500 ml-auto">
              member
            </span>
          )}
          {isCreator && (
            <span className="text-[9px] font-mono text-blue-400 ml-auto">
              owner
            </span>
          )}
        </div>
      </div>

      <ProjectDetailsModal
        project={project}
        isOpen={showModal}
        onClose={handleModalClose}
        onStatusChange={handleStatusChange}
        onInvitationCodeUpdated={handleInvitationUpdate}
      />
    </>
  );
}

ProjectItem.displayName = "ProjectItem";

export default memo(ProjectItem);
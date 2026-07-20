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
  const statusClass = project.isActive !== false ? "text-emerald-400 font-bold" : "text-amber-500";

  // Build classes for the main container
  const containerClasses = `flex flex-col py-2.5 px-3 cursor-pointer border-b transition-colors select-none ${
    isSelected
      ? "bg-[#094771] text-white border-l-2 border-blue-400"
      : isWhiteTheme
      ? "hover:bg-gray-100 text-gray-700"
      : "hover:bg-zinc-800 text-gray-400"
  }`;

  return (
    <>
      <div onClick={handleProjectClick} className={containerClasses}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs truncate max-w-[80%]">
            {project.projectname}
          </span>
          {isCreator && (
            <button
              onClick={handleSettingsClick}
              className="bg-blue-600 hover:bg-blue-500 text-white px-1.5 py-0.5 rounded text-xs font-bold transition-colors"
              aria-label="Project settings"
            >
              ⋮
            </button>
          )}
        </div>
        <div className="text-[10px] uppercase font-mono mt-0.5">
          status: <span className={statusClass}>{statusText}</span>
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
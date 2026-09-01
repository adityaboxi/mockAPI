// src/components/ProjectList/ProjectItem.jsx
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
    await selectProject(project.projectname, project.id, project.invitationCode);
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
      onStatusChange?.(project.id, stat);
    },
    [onStatusChange, project.id]
  );

  const handleInvitationUpdate = useCallback(
    (id, code) => {
      onProjectUpdate?.(id, { invitationCode: code });
    },
    [onProjectUpdate]
  );

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleProjectClick();
    }
  }, [handleProjectClick]);

  // Memoize the status text and color class
  const isActive = project.isActive !== false;
  const statusText = isActive ? "Active" : "Inactive";
  const statusDot = isActive ? "bg-emerald-400 shadow-xs shadow-emerald-400/50" : "bg-zinc-500";
  const statusClass = isActive ? "text-emerald-400" : "text-zinc-500";

  // ─── Theme-aware design tokens ─────────────────────────────────
  const baseClasses = `
    group mx-1.5 my-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 select-none border outline-none
  `;

  const selectedClasses = isSelected
    ? isWhiteTheme
      ? "bg-blue-50/80 border-blue-200 text-slate-900 shadow-xs"
      : "bg-blue-600/10 border-blue-500/30 text-white shadow-xs shadow-blue-500/10"
    : isWhiteTheme
      ? "bg-transparent border-transparent hover:bg-slate-100/80 text-slate-700 hover:border-slate-200/60"
      : "bg-transparent border-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800/60";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={handleProjectClick}
        onKeyDown={handleKeyDown}
        className={`${baseClasses} ${selectedClasses}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs opacity-75 shrink-0" aria-hidden="true">📁</span>
            <span className="font-semibold text-xs truncate tracking-wide">
              {project.projectname}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isCreator && (
              <button
                type="button"
                onClick={handleSettingsClick}
                className={`
                  p-1 rounded-md transition-all
                  ${isWhiteTheme
                    ? "text-slate-400 hover:text-slate-700 hover:bg-slate-200/80"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                  }
                  focus:outline-none focus:ring-1 focus:ring-blue-500
                `}
                aria-label="Workspace options"
                title="Workspace settings & telemetry"
              >
                <span className="text-xs font-bold leading-none">⋯</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5 pl-5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot} shrink-0`} />
          <span className={`text-[10px] font-mono font-medium uppercase tracking-wider ${statusClass}`}>
            {statusText}
          </span>
          <span className="ml-auto text-[9px] font-mono px-1.5 py-0.2 rounded border border-transparent group-hover:border-zinc-700/40 opacity-70">
            {isCreator ? "OWNER" : "MEMBER"}
          </span>
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
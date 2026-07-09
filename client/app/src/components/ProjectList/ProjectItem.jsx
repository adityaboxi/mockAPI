import React, { useState } from "react";
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
  const isCreator = user?.username === project.username;

  const handleProjectClick = async () => {
    await selectProject(project.projectname, project.id);
    if (onClick) onClick(project);
  };

  return (
    <>
      <div
        onClick={handleProjectClick}
        className={`flex flex-col py-2.5 px-3 cursor-pointer border-b transition-colors select-none ${
          isSelected
            ? "bg-[#094771] text-white border-l-2 border-blue-400"
            : isWhiteTheme
            ? "hover:bg-gray-100 text-gray-700"
            : "hover:bg-zinc-800 text-gray-400"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs truncate max-w-[80%]">{project.projectname}</span>
          {isCreator && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              className="text-xs font-bold px-1 text-zinc-500 hover:text-white"
            >
              ⋮
            </button>
          )}
        </div>
        <div className="text-[10px] uppercase font-mono mt-0.5">
          status:{" "}
          <span
            className={
              project.isActive !== false ? "text-emerald-400 font-bold" : "text-amber-500"
            }
          >
            {project.isActive !== false ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      <ProjectDetailsModal
        project={project}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onStatusChange={(stat) => onStatusChange(project.id, stat)}
        onInvitationCodeUpdated={(id, code) => onProjectUpdate(id, { invitationCode: code })}
      />
    </>
  );
}

export default ProjectItem;
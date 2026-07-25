import React from "react";
import ProjectCreateInput from "./ProjectList/ProjectCreateInput";
import ProjectJoinInput from "./ProjectList/ProjectJoinInput";

const CreateJoinSection = React.memo(({ user, onProjectCreated, onProjectJoined, theme }) => {
  const isWhiteTheme = theme === "white";

  // Theme-aware styles
  const bg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const border = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const shadow = isWhiteTheme ? "shadow-sm" : "shadow-none";
  const divider = isWhiteTheme ? "border-gray-100" : "border-zinc-800/60";

  return (
    <div className={`rounded-xl ${bg} ${border} ${shadow} p-5 space-y-5 border`}>
      {/* Create section */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold tracking-wider uppercase ${
            isWhiteTheme ? "text-gray-500" : "text-zinc-400"
          }`}>
            Create Project
          </span>
          <div className={`flex-1 h-px ${divider}`} />
        </div>
        <ProjectCreateInput
          user={user}
          onProjectCreated={onProjectCreated}
          refreshProjects={() => {}}
          isWhiteTheme={isWhiteTheme}
        />
      </div>

      {/* Divider line between sections */}
      <div className={`border-t ${divider}`} />

      {/* Join section */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold tracking-wider uppercase ${
            isWhiteTheme ? "text-gray-500" : "text-zinc-400"
          }`}>
            Join Project
          </span>
          <div className={`flex-1 h-px ${divider}`} />
        </div>
        <ProjectJoinInput
          user={user}
          onProjectJoined={onProjectJoined}
          refreshProjects={() => {}}
          isWhiteTheme={isWhiteTheme}
        />
      </div>
    </div>
  );
});

export default CreateJoinSection;
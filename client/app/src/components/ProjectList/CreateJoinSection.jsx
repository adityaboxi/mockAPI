import React from "react";
import ProjectCreateInput from "./ProjectCreateInput";
import ProjectJoinInput from "./ProjectJoinInput";

const CreateJoinSection = React.memo(({ user, onProjectCreated, onProjectJoined, theme }) => {
  const isWhiteTheme = theme === "white";

  // Themee-aware styles
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const shadow = isWhiteTheme ? "shadow-sm" : "shadow-none";
  const divider = isWhiteTheme ? "border-gray-100" : "border-zinc-800/60";
  const labelText = isWhiteTheme ? "text-gray-500" : "text-zinc-400";

  return (
    <div className={`rounded-xl ${cardBg} ${borderColor} ${shadow} p-5 space-y-5 border`}>
      {/* Create Project Section */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold tracking-wider uppercase ${labelText}`}>
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

      {/* Divider line */}
      <div className={`border-t ${divider}`} />

      {/* Join Project Section */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold tracking-wider uppercase ${labelText}`}>
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
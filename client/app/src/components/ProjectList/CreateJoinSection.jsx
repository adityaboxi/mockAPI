// src/components/ProjectList/CreateJoinSection.jsx
import React from "react";
import ProjectCreateInput from "./ProjectCreateInput";
import ProjectJoinInput from "./ProjectJoinInput";

const CreateJoinSection = React.memo(({ user, onProjectCreated, onProjectJoined, theme }) => {
  const isWhiteTheme = theme === "white";

  // Theme-aware styles
  const cardBg = isWhiteTheme ? "bg-slate-50/70" : "bg-zinc-900/60";
  const borderColor = isWhiteTheme ? "border-slate-200/80" : "border-zinc-800/80";
  const divider = isWhiteTheme ? "border-slate-200/60" : "border-zinc-800/60";
  const labelText = isWhiteTheme ? "text-slate-500" : "text-zinc-400";

  return (
    <div className={`rounded-xl ${cardBg} ${borderColor} p-3 mx-2 my-1.5 space-y-3.5 border shadow-2xs`}>
      {/* Create Project Section */}
      <section className="space-y-1" aria-label="Create Workspace">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold tracking-wider uppercase select-none ${labelText}`}>
            Create Workspace
          </span>
          <div className={`flex-1 h-px ${divider}`} />
        </div>
        <ProjectCreateInput
          user={user}
          onProjectCreated={onProjectCreated}
          refreshProjects={onProjectCreated}
          isWhiteTheme={isWhiteTheme}
        />
      </section>

      {/* Divider line */}
      <div className={`border-t ${divider}`} />

      {/* Join Project Section */}
      <section className="space-y-1" aria-label="Join Workspace">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold tracking-wider uppercase select-none ${labelText}`}>
            Join Workspace
          </span>
          <div className={`flex-1 h-px ${divider}`} />
        </div>
        <ProjectJoinInput
          user={user}
          onProjectJoined={onProjectJoined}
          refreshProjects={onProjectJoined}
          isWhiteTheme={isWhiteTheme}
        />
      </section>
    </div>
  );
});

CreateJoinSection.displayName = "CreateJoinSection";

export default CreateJoinSection;
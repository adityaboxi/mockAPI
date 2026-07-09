import React from "react";
import ProjectCreateInput from "./ProjectCreateInput";
import ProjectJoinInput from "./ProjectJoinInput";

const CreateJoinSection = React.memo(({ user, onProjectCreated, onProjectJoined, theme }) => {
  const isWhiteTheme = theme === "white";

  return (
    <div className="p-3 flex flex-col gap-4 border-b">
      <ProjectCreateInput
        user={user}
        onProjectCreated={onProjectCreated}
        refreshProjects={() => {}}
        isWhiteTheme={isWhiteTheme}
      />
      <ProjectJoinInput
        user={user}
        onProjectJoined={onProjectJoined}
        refreshProjects={() => {}}
        isWhiteTheme={isWhiteTheme}
      />
    </div>
  );
});

export default CreateJoinSection;
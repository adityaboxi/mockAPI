import React, { useState } from "react";

const ProjectCreateInput = React.memo(({ user, onProjectCreated, isWhiteTheme }) => {
  const [newProjectNameInput, setNewProjectNameInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [globalInvitationCode, setGlobalInvitationCode] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCreateProject = async () => {
    if (!user || user.role === "guest") return;
    const projectName = newProjectNameInput.trim();
    if (!projectName) return;
    setIsCreating(true);
    try {
      const url = `${import.meta.env.VITE_API_URL_CREATEPROJECT}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectname: projectName }),
      });
      if (!res.ok) throw new Error(await res.json());
      const newProject = await res.json();
      if (newProject.invitationCode) setGlobalInvitationCode(newProject.invitationCode);
      setNewProjectNameInput("");
      if (onProjectCreated) onProjectCreated(newProject);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const copyInvitationCode = async () => {
    if (globalInvitationCode) {
      await navigator.clipboard.writeText(globalInvitationCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1 className={`text-xs font-medium ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>
          Create Project
        </h1>
        <div className="flex gap-2">
          {globalInvitationCode && (
            <button
              onClick={() => setGlobalInvitationCode("")}
              className="bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 text-xs rounded"
            >
              ✕
            </button>
          )}
          <button
            onClick={handleCreateProject}
            disabled={isCreating}
            className={`border px-2 py-1 text-xs rounded transition-colors ${
              isWhiteTheme
                ? `bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700`
                : `bg-[#1e1f22] hover:bg-zinc-700 border-zinc-700/50 text-gray-300`
            }`}
          >
            {isCreating ? "Creating..." : "+ New"}
          </button>
        </div>
      </div>
      <input
        type="text"
        placeholder="Enter project name..."
        value={newProjectNameInput}
        onChange={(e) => setNewProjectNameInput(e.target.value)}
        disabled={isCreating}
        className={`w-full rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors disabled:opacity-50 ${
          isWhiteTheme
            ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400"
            : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-500"
        }`}
      />
      {globalInvitationCode && (
        <div
          className={`flex items-center gap-2 border rounded p-1 pl-2 mt-1 ${
            isWhiteTheme
              ? "bg-blue-50 border-blue-300"
              : "bg-[#094771]/30 border-blue-500/50"
          }`}
        >
          <input
            type="text"
            readOnly
            value={globalInvitationCode}
            className={`flex-1 outline-none text-xs bg-transparent ${
              isWhiteTheme ? "text-blue-700" : "text-blue-200"
            }`}
          />
          <button
            onClick={copyInvitationCode}
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
              isWhiteTheme
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-blue-600/80 hover:bg-blue-500 text-white"
            }`}
          >
            {copySuccess ? "✓ Copied!" : "📋 Copy"}
          </button>
        </div>
      )}
    </div>
  );
});

export default ProjectCreateInput;
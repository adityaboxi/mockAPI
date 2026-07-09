import React, { useState, useEffect, useRef } from "react";

const ProjectJoinInput = React.memo(({ user, onProjectJoined, refreshProjects, isWhiteTheme }) => {
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Create a ref to store the timeout ID so we can clear it if the component unmounts
  const timeoutRef = useRef(null);

  // Clean up any active timers when the component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleJoinProject = async () => {
    if (!user || user.role === "guest") return;
    const joinCode = joinCodeInput.trim();
    if (!joinCode) return;
    setIsJoining(true);
    try {
      const url = `${import.meta.env.VITE_API_URL_JOINPROJECT}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ joinCode }),
      });
      if (!res.ok) throw new Error(await res.json());
      const joinedProject = await res.json();
      
      setJoinCodeInput("");
      setSuccessMessage("Join request sent to manager!");

      // Clear any previous active timeout before starting a new one
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Set a timer to clear the success message after 5000ms (5 seconds)
      timeoutRef.current = setTimeout(() => {
        setSuccessMessage("");
      }, 3000);

      if (refreshProjects) await refreshProjects();
      if (onProjectJoined) onProjectJoined(joinedProject);
    } catch (error) {
   
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1 className={`text-xs font-medium ${isWhiteTheme ? "text-gray-500" : "text-gray-400"}`}>
          Join Project
        </h1>
        <button
          onClick={handleJoinProject}
          disabled={isJoining}
          className={`border px-2 py-1 text-xs rounded transition-colors ${
            isWhiteTheme
              ? `bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700`
              : `bg-[#1e1f22] hover:bg-zinc-700 border-zinc-700/50 text-gray-300`
          }`}
        >
          {isJoining ? "Joining..." : "Join"}
        </button>
      </div>
      <div className="flex gap-1 items-center">
        <input
          type="text"
          placeholder="Paste join code here..."
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value)}
          disabled={isJoining}
          className={`flex-1 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors disabled:opacity-50 ${
            isWhiteTheme
              ? "bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400"
              : "bg-[#1e1f22] border border-zinc-700/50 text-gray-200 placeholder-zinc-500"
          }`}
        />
        <button
          onClick={() => setJoinCodeInput("")}
          disabled={isJoining}
          className={`px-2 py-1.5 text-xs rounded transition-colors ${
            isWhiteTheme
              ? `bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600`
              : `bg-[#1e1f22] hover:bg-zinc-700 border border-zinc-700/50 text-gray-400`
          }`}
        >
          ⌫
        </button>
      </div>

      {successMessage && (
        <div className="text-xs text-center text-emerald-500 mt-1">
          {successMessage}
        </div>
      )}
    </div>
  );
});

export default ProjectJoinInput;
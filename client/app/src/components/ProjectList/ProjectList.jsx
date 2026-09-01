import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ProjectItem from "./ProjectItem";
import CreateJoinSection from "./CreateJoinSection";
import { useSocket } from "../../context/SocketContext";

function ProjectList({ user, onProjectSelect, theme }) {
  const socket = useSocket();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isWhiteTheme = theme === "white";
  const hasInitialFetch = useRef(false);
  const joinedRooms = useRef(new Set());

  // ---------- Memoize project IDs (for joining) ----------
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);

  // ---------- Fetch projects (once) ----------
  const fetchProjects = useCallback(async () => {
    if (!user?.username || user?.role === 'guest') return;
    if (hasInitialFetch.current) return;
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({ role: user.role }).toString();
      const res = await fetch(`${import.meta.env.VITE_API_URL_PROJECTS}?${queryParams}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Fetch mismatch error");
      const data = await res.json();
      const projectsData = Array.isArray(data) ? data : [];
      setProjects(projectsData);
      hasInitialFetch.current = true;
    } catch (error) {
      console.error(error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.username, user?.role]);

  // ---------- Initial fetch ----------
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ---------- Socket: join rooms and listen for updates ----------
  useEffect(() => {
    if (!socket || !user?.username) return;

    const userRoom = `user_${user.username}`;
    if (!joinedRooms.current.has(userRoom)) {
      socket.emit("join_room", userRoom);
      joinedRooms.current.add(userRoom);
    }

    projectIds.forEach(projectId => {
      if (projectId && !joinedRooms.current.has(projectId)) {
        socket.emit("join_project", projectId);
        joinedRooms.current.add(projectId);
      }
    });

    const handleJoinApproved = (data) => {
      if (!data?.project) return;
      const newProject = data.project;
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === newProject.id);
        if (exists) return prev;
        if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
          socket.emit("join_project", newProject.id);
          joinedRooms.current.add(newProject.id);
        }
        return [newProject, ...prev];
      });
    };

    const handleStatusChanged = ({ projectId, isActive }) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, isActive } : p))
      );
    };

    socket.on("join_request_approved", handleJoinApproved);
    socket.on("project_status_changed", handleStatusChanged);

    return () => {
      socket.off("join_request_approved", handleJoinApproved);
      socket.off("project_status_changed", handleStatusChanged);
    };
  }, [socket, user?.username, projectIds]);

  // ---------- Handlers (memoized) ----------
  const handleProjectCreated = useCallback((response) => {
    if (!response?.project) return;
    const newProject = response.project;
    setProjects((prev) => [newProject, ...prev]);
    if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
      socket.emit("join_project", newProject.id);
      joinedRooms.current.add(newProject.id);
    }
    handleProjectClick(newProject);
  }, [socket]);

  const handleStatusChange = useCallback((projectId, newStatus) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isActive: newStatus } : p))
    );
  }, []);

  const handleProjectUpdate = useCallback((projectId, updates) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
    );
  }, []);

  const handleProjectClick = useCallback((project) => {
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.projectname);
    onProjectSelect(project);
  }, [onProjectSelect]);

  // ---------- Theme-aware styles ----------
  const sidebarBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const headerBg = isWhiteTheme ? "bg-white/80" : "bg-zinc-900/80";
  const headerText = isWhiteTheme ? "text-gray-700" : "text-zinc-300";
  const badgeBg = isWhiteTheme ? "bg-gray-200 text-gray-700" : "bg-zinc-700 text-zinc-300";
  const countBg = isWhiteTheme ? "bg-gray-100 text-gray-600" : "bg-zinc-800 text-zinc-400";

  // ---------- Render ----------
  return (
    <aside
      className={`
        w-72 shrink-0 border-r flex flex-col h-full
        ${sidebarBg} ${borderColor}
        transition-colors duration-200
      `}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-2.5 border-b shrink-0
          ${headerBg} ${borderColor} ${headerText}
        `}
      >
        <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-2">
          <span>📁</span> Workspaces
        </span>
        <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${badgeBg}`}>
          {projects.length}
        </span>
      </div>

      {/* Create/Join section */}
      <CreateJoinSection
        user={user}
        onProjectCreated={handleProjectCreated}
        onProjectJoined={fetchProjects}
        theme={theme}
      />

      {/* Project list */}
      <div
        className={`
          flex-1 overflow-y-auto py-2 px-2 space-y-0.5
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          ${isWhiteTheme
            ? "[&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400"
            : "[&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
          }
        `}
      >
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isWhiteTheme ? "border-gray-300 border-t-gray-600" : "border-zinc-700 border-t-blue-400"}`} />
          </div>
        )}
        {!isLoading && projects.length === 0 && (
          <div className={`text-center text-xs italic py-6 ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"}`}>
            No workspaces yet.<br />
            Create or join one above.
          </div>
        )}
        {projects.map((p, i) => (
          <ProjectItem
            key={p.id || i}
            project={p}
            isSelected={selectedProjectId === p.id}
            onClick={handleProjectClick}
            onStatusChange={handleStatusChange}
            onProjectUpdate={handleProjectUpdate}
          />
        ))}
      </div>
    </aside>
  );
}

export default ProjectList;
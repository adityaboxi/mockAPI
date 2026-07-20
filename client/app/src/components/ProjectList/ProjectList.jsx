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
      // Join rooms for all projects (handled in separate effect)
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

    // Join user room (once)
    const userRoom = `user_${user.username}`;
    if (!joinedRooms.current.has(userRoom)) {
      socket.emit("join_room", userRoom);
      joinedRooms.current.add(userRoom);
    }

    // Join project rooms (only if not already joined)
    projectIds.forEach(projectId => {
      if (projectId && !joinedRooms.current.has(projectId)) {
        socket.emit("join_project", projectId);
        joinedRooms.current.add(projectId);
      }
    });

    // ---------- Socket event: join approved ----------
    const handleJoinApproved = (data) => {
      if (!data?.project) return;
      const newProject = data.project;
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === newProject.id);
        if (exists) return prev;
        // Join the new project room if not already
        if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
          socket.emit("join_project", newProject.id);
          joinedRooms.current.add(newProject.id);
        }
        return [newProject, ...prev];
      });
    };

    // ---------- Socket event: status changed ----------
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
  }, [socket, user?.username, projectIds]); // ✅ projectIds instead of projects to avoid stale joins

  // ---------- Handlers (memoized) ----------
  const handleProjectCreated = useCallback((response) => {
    if (!response?.project) return;
    const newProject = response.project;
    setProjects((prev) => [newProject, ...prev]);
    // Socket join is handled inside the listener (handleJoinApproved) – but we also do it here for immediate join
    if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
      socket.emit("join_project", newProject.id);
      joinedRooms.current.add(newProject.id);
    }
    handleProjectClick(newProject);
  }, [socket]); // handleProjectClick defined below

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

  // ---------- Render ----------
  return (
    <aside
      className={`w-72 shrink-0 border-r flex flex-col ${
        isWhiteTheme ? "bg-white border-gray-200" : "bg-[#2b2d31] border-zinc-700/50"
      }`}
    >
      <div
        className={`flex text-xs font-medium border-b shrink-0 py-2 items-center justify-center gap-2 ${
          isWhiteTheme ? "bg-gray-50 text-gray-700" : "bg-[#232428] text-white"
        }`}
      >
        <span>📁</span> Workspaces{" "}
        <span className={`px-1.5 rounded ${
          isWhiteTheme 
            ? "bg-gray-200 text-gray-700" 
            : "bg-zinc-700 text-gray-300"
        }`}>
          {projects.length}
        </span>
      </div>
      <CreateJoinSection
        user={user}
        onProjectCreated={handleProjectCreated}
        onProjectJoined={fetchProjects}
        theme={theme}
      />
      <div className="flex-1 overflow-y-auto py-2">
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
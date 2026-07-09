import { useState, useEffect, useCallback, useRef } from "react";
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
  const joinedRooms = useRef(new Set()); // track rooms already joined

  const fetchProjects = useCallback(async () => {
    if (!user?.username) return;
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

      // Join rooms for each project (only once, but only if socket is ready)
      if (socket) {
        projectsData.forEach(project => {
          if (project.id && !joinedRooms.current.has(project.id)) {
            socket.emit("join_project", project.id);
            joinedRooms.current.add(project.id);
          }
        });
      }
    } catch (error) {
      console.error(error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.username, user?.role, socket]);

  // Socket event listeners (runs once when socket becomes available)
  useEffect(() => {
    if (!socket || !user?.username) return;

    // Join personal room (only once)
    const userRoom = `user_${user.username}`;
    if (!joinedRooms.current.has(userRoom)) {
      socket.emit("join_room", userRoom);
      joinedRooms.current.add(userRoom);
    }

    // Join rooms for already loaded projects (if any) – avoid duplicates via Set
    projects.forEach(project => {
      if (project.id && !joinedRooms.current.has(project.id)) {
        socket.emit("join_project", project.id);
        joinedRooms.current.add(project.id);
      }
    });

    const handleJoinApproved = (data) => {
      if (!data?.project) return;
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === data.project.id);
        if (exists) return prev;
        // Join the new project room
        if (socket && !joinedRooms.current.has(data.project.id)) {
          socket.emit("join_project", data.project.id);
          joinedRooms.current.add(data.project.id);
        }
        return [data.project, ...prev];
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
      // Do NOT disconnect the shared socket
    };
  }, [socket, user?.username, projects]); // projects added to update rooms when new projects arrive

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectCreated = (response) => {
    if (!response?.project) return;
    const newProject = response.project;
    setProjects((prev) => [newProject, ...prev]);
    if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
      socket.emit("join_project", newProject.id);
      joinedRooms.current.add(newProject.id);
    }
    handleProjectClick(newProject);
  };

  const handleStatusChange = (projectId, newStatus) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isActive: newStatus } : p))
    );
  };

  const handleProjectUpdate = (projectId, updates) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
    );
  };

  const handleProjectClick = (project) => {
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.projectname);
    onProjectSelect(project);
  };

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
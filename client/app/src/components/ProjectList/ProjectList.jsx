// src/components/ProjectList/ProjectList.jsx
import React, { useEffect, useCallback, useRef, useMemo } from "react";
import ProjectItem from "./ProjectItem";
import CreateJoinSection from "../CreateJoinSection";
import { useSocket } from "../../context/SocketContext";
import { useProject } from "../../context/ProjectContext";

function ProjectList({ user, onProjectSelect, theme }) {
  const socket = useSocket();
  const {
    projects,
    isLoading,
    fetchProjects,
    addProject,
    updateProject,
    deleteProject,
    setProjectStatus,
    currentProject,
    selectProject,
  } = useProject();

  const isWhiteTheme = theme === "white";
  const joinedRooms = useRef(new Set());
  const safeProjects = Array.isArray(projects) ? projects : [];

  // ---------- Memoize project IDs ----------
  const projectIds = useMemo(() => safeProjects.map((p) => p.id), [safeProjects]);

  // ---------- Socket: join rooms and listen for updates ----------
  useEffect(() => {
    if (!socket || !user?.username) return;

    const userRoom = `user_${user.username}`;
    if (!joinedRooms.current.has(userRoom)) {
      socket.emit("join_room", userRoom);
      joinedRooms.current.add(userRoom);
    }

    projectIds.forEach((projectId) => {
      if (projectId && !joinedRooms.current.has(projectId)) {
        socket.emit("join_project", projectId);
        joinedRooms.current.add(projectId);
      }
    });

    const handleProjectCreatedSocket = (data) => {
      if (!data?.project) return;
      addProject(data.project);
      if (socket && data.project.id && !joinedRooms.current.has(data.project.id)) {
        socket.emit("join_project", data.project.id);
        joinedRooms.current.add(data.project.id);
      }
    };

    const handleProjectDeletedSocket = ({ projectId }) => {
      if (!projectId) return;
      deleteProject(projectId);
      joinedRooms.current.delete(projectId);
      if (socket) {
        socket.emit("leave_project", projectId);
      }
    };

    const handleJoinApproved = (data) => {
      if (!data?.project) return;
      const newProject = data.project;
      addProject(newProject);
      if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
        socket.emit("join_project", newProject.id);
        joinedRooms.current.add(newProject.id);
      }
    };

    const handleStatusChanged = ({ projectId, isActive }) => {
      setProjectStatus(projectId, isActive);
    };

    const handleInvitationCodeUpdated = ({ projectId, invitationCode }) => {
      if (projectId && invitationCode) {
        updateProject(projectId, { invitationCode });
      }
    };

    const handleMemberJoined = ({ projectId, members, noofmemebers }) => {
      if (projectId) {
        updateProject(projectId, { members, noofmemebers });
      }
    };

    socket.on("project_created", handleProjectCreatedSocket);
    socket.on("project_deleted", handleProjectDeletedSocket);
    socket.on("join_request_approved", handleJoinApproved);
    socket.on("project_status_changed", handleStatusChanged);
    socket.on("invitation_code_updated", handleInvitationCodeUpdated);
    socket.on("member_joined", handleMemberJoined);

    return () => {
      socket.off("project_created", handleProjectCreatedSocket);
      socket.off("project_deleted", handleProjectDeletedSocket);
      socket.off("join_request_approved", handleJoinApproved);
      socket.off("project_status_changed", handleStatusChanged);
      socket.off("invitation_code_updated", handleInvitationCodeUpdated);
      socket.off("member_joined", handleMemberJoined);
    };
  }, [socket, user?.username, projectIds, addProject, updateProject, deleteProject, setProjectStatus]);

  // ---------- Handlers ----------
  const handleProjectCreated = useCallback((response) => {
    if (!response) return;
    const newProject = response.project || response;
    if (!newProject?.id) return;
    addProject(newProject);
    selectProject(newProject.projectname, newProject.id, newProject.invitationCode);
    if (socket && newProject.id && !joinedRooms.current.has(newProject.id)) {
      socket.emit("join_project", newProject.id);
      joinedRooms.current.add(newProject.id);
    }
  }, [socket, addProject, selectProject]);

  const handleStatusChange = useCallback((projectId, newStatus) => {
    setProjectStatus(projectId, newStatus);
  }, [setProjectStatus]);

  const handleProjectUpdate = useCallback((projectId, updates) => {
    updateProject(projectId, updates);
  }, [updateProject]);

  const handleProjectClick = useCallback((project) => {
    selectProject(project.projectname, project.id, project.invitationCode);
    if (onProjectSelect) onProjectSelect(project);
  }, [selectProject, onProjectSelect]);

  // ---------- Theme-aware styles ----------
  const sidebarBg = isWhiteTheme ? "bg-slate-50/50" : "bg-[#0c0c0e]/50";
  const borderColor = isWhiteTheme ? "border-slate-200/80" : "border-zinc-800/60";
  const headerBg = isWhiteTheme ? "bg-white/60" : "bg-zinc-900/40";
  const headerText = isWhiteTheme ? "text-slate-700" : "text-zinc-300";
  const badgeBg = isWhiteTheme ? "bg-slate-200 text-slate-700" : "bg-zinc-800 text-zinc-300";

  return (
    <aside
      className={`
        w-full shrink-0 flex flex-col h-full
        ${sidebarBg}
        transition-colors duration-200
      `}
      aria-label="Workspaces sidebar"
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 select-none
          ${headerBg} ${borderColor} ${headerText}
        `}
      >
        <span className="text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5">
          <span aria-hidden="true">📁</span> Workspaces
        </span>
        <span className={`text-[10px] font-mono rounded-full px-2 py-0.2 font-semibold ${badgeBg}`}>
          {safeProjects.length}
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
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 custom-scrollbar">
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isWhiteTheme ? "border-gray-300 border-t-gray-600" : "border-zinc-700 border-t-blue-400"}`} />
          </div>
        )}
        {!isLoading && safeProjects.length === 0 && (
          <div className={`text-center text-xs italic py-6 ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"}`}>
            No workspaces yet.<br />
            Create or join one above.
          </div>
        )}
        {safeProjects.map((p, i) => (
          <ProjectItem
            key={p.id || `proj-${i}`}
            project={p}
            isSelected={currentProject?.id === p.id}
            onClick={handleProjectClick}
            onStatusChange={handleStatusChange}
            onProjectUpdate={handleProjectUpdate}
          />
        ))}
      </div>
    </aside>
  );
}

export default React.memo(ProjectList);
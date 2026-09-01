// src/context/ProjectContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '../services/apiClient';

const ProjectContext = createContext(null);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Refs for deduplication and caching
  const pendingVerification = useRef(new Map());
  const verificationCache = useRef(new Map());
  const isMountedRef = useRef(true);

  const VERIFY_PROJECT_URL = import.meta.env.VITE_API_URL_VERIFY_PROJECT || '/api/verify-project';
  const PROJECTS_URL = import.meta.env.VITE_API_URL_PROJECTS || '/api/projects';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Fetch projects from backend ──────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    if (!user?.username || user?.role === 'guest') {
      if (isMountedRef.current) {
        setProjects([]);
        setIsLoading(false);
      }
      return [];
    }

    try {
      const queryParams = new URLSearchParams({ role: user.role }).toString();
      const data = await apiClient.get(`${PROJECTS_URL}?${queryParams}`);
      const projectsData = Array.isArray(data) ? data : [];

      if (!isMountedRef.current) return projectsData;
      setProjects(projectsData);

      // Restore previously active project or select first
      if (projectsData.length > 0) {
        let restoredProject = null;
        try {
          const saved = JSON.parse(localStorage.getItem('active_project') || 'null');
          if (saved && saved.id) {
            const found = projectsData.find((p) => p.id === saved.id);
            if (found) {
              restoredProject = {
                id: found.id,
                name: found.projectname,
                invitationCode: found.invitationCode || null,
                selectedAt: Date.now(),
              };
            }
          }
        } catch (_) {}

        setCurrentProject((prev) => {
          if (prev && projectsData.some((p) => p.id === prev.id)) {
            return prev;
          }
          if (restoredProject) return restoredProject;
          const first = projectsData[0];
          return {
            id: first.id,
            name: first.projectname,
            invitationCode: first.invitationCode || null,
            selectedAt: Date.now(),
          };
        });
      } else {
        setCurrentProject(null);
      }
      return projectsData;
    } catch (error) {
      console.error('[ProjectContext] Failed to fetch projects:', error);
      return [];
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [user?.username, user?.role, PROJECTS_URL]);

  // ─── Initial fetch on user login & Session Cleanup ────────────────────────
  useEffect(() => {
    verificationCache.current.clear();
    pendingVerification.current.clear();

    if (!user || user.role === 'guest') {
      setCurrentProject(null);
      setProjects([]);
      setIsLoading(false);
      return;
    }

    fetchProjects();
  }, [user?.username, user?.role, fetchProjects]);

  // ─── Verify project access (with caching) ──────────────────────────────────
  const verifyProjectAccess = useCallback(async (projectId) => {
    if (!projectId) return false;
    if (!user || user.role === 'guest') return false;

    if (verificationCache.current.has(projectId)) {
      return verificationCache.current.get(projectId);
    }

    if (pendingVerification.current.has(projectId)) {
      return pendingVerification.current.get(projectId);
    }

    const promise = (async () => {
      try {
        await apiClient.post(VERIFY_PROJECT_URL, { projectId });
        verificationCache.current.set(projectId, true);
        return true;
      } catch (error) {
        console.warn('Project verification failed:', error.message);
        verificationCache.current.set(projectId, false);
        return false;
      } finally {
        pendingVerification.current.delete(projectId);
      }
    })();

    pendingVerification.current.set(projectId, promise);
    return promise;
  }, [VERIFY_PROJECT_URL, user]);

  // ─── Select a project ──────────────────────────────────────────────────────
  const selectProject = useCallback((projectName, projectId, invitationCode) => {
    if (!projectId || !projectName) {
      return;
    }

    const newProject = {
      id: projectId,
      name: projectName,
      invitationCode: invitationCode || null,
      selectedAt: Date.now(),
    };

    setCurrentProject(newProject);

    try {
      localStorage.setItem('active_project', JSON.stringify({ id: projectId, name: projectName, invitationCode }));
    } catch { /* ignore */ }
  }, []);

  // ─── Clear project selection ──────────────────────────────────────────────
  const clearProject = useCallback(() => {
    setCurrentProject(null);
    try {
      localStorage.removeItem('active_project');
    } catch { /* ignore */ }
  }, []);

  // ─── Mutations for Real-Time State Sync ────────────────────────────────────
  const addProject = useCallback((newProject) => {
    if (!newProject?.id) return;
    setProjects((prev) => {
      if (prev.some((p) => p.id === newProject.id)) return prev;
      return [newProject, ...prev];
    });
    selectProject(newProject.projectname, newProject.id, newProject.invitationCode);
  }, [selectProject]);

  const updateProject = useCallback((projectId, updates) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
    );
    setCurrentProject((prev) => {
      if (prev && prev.id === projectId) {
        return {
          ...prev,
          name: updates.projectname || prev.name,
          invitationCode: updates.invitationCode !== undefined ? updates.invitationCode : prev.invitationCode,
        };
      }
      return prev;
    });
  }, []);

  const setProjectStatus = useCallback((projectId, isActive) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isActive } : p))
    );
  }, []);

  const deleteProject = useCallback((projectId) => {
    if (!projectId) return;
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      setCurrentProject((curr) => {
        if (curr && curr.id === projectId) {
          try { localStorage.removeItem('active_project'); } catch {}
          if (updated.length > 0) {
            const next = updated[0];
            return {
              id: next.id,
              name: next.projectname,
              invitationCode: next.invitationCode || null,
              selectedAt: Date.now(),
            };
          }
          return null;
        }
        return curr;
      });
      return updated;
    });
    verificationCache.current.delete(projectId);
  }, []);

  const invalidateProjectCache = useCallback((projectId) => {
    if (projectId) {
      verificationCache.current.delete(projectId);
    } else {
      verificationCache.current.clear();
    }
  }, []);

  const value = useMemo(() => ({
    currentProject,
    projects,
    isLoading,
    fetchProjects,
    selectProject,
    clearProject,
    addProject,
    updateProject,
    deleteProject,
    setProjectStatus,
    verifyProjectAccess,
    invalidateProjectCache,
  }), [
    currentProject,
    projects,
    isLoading,
    fetchProjects,
    selectProject,
    clearProject,
    addProject,
    updateProject,
    deleteProject,
    setProjectStatus,
    verifyProjectAccess,
    invalidateProjectCache,
  ]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const ProjectContext = createContext();

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
  const [isLoading, setIsLoading] = useState(true);

  // Refs for deduplication and caching
  const pendingVerification = useRef(new Map()); // projectId -> Promise
  const verificationCache = useRef(new Map());   // projectId -> boolean (cached result)

  const VERIFY_PROJECT_URL = import.meta.env.VITE_API_URL_VERIFY_PROJECT;

  // ─── Effect: clear project when user logs out / changes ───────────────────
  useEffect(() => {
    if (!user || user.role === 'guest') {
      setCurrentProject(null);
    }
    // We set loading to false after the initial user check
    setIsLoading(false);
  }, [user]);

  // ─── Verify project access (with deduplication & caching) ──────────────────
  const verifyProjectAccess = useCallback(async (projectId) => {
    if (!projectId) return false;
    if (!user || user.role === 'guest') return false;

    // Check cache first
    if (verificationCache.current.has(projectId)) {
      return verificationCache.current.get(projectId);
    }

    // If a verification is already in-flight, return that promise
    if (pendingVerification.current.has(projectId)) {
      return pendingVerification.current.get(projectId);
    }

    const promise = (async () => {
      try {
        const response = await fetch(VERIFY_PROJECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ projectId })
        });
        const isValid = response.ok;
        // Cache the result
        verificationCache.current.set(projectId, isValid);
        return isValid;
      } catch (error) {
        console.error('Project verification error:', error);
        return false;
      } finally {
        pendingVerification.current.delete(projectId);
      }
    })();

    pendingVerification.current.set(projectId, promise);
    return promise;
  }, [VERIFY_PROJECT_URL, user]);

  // ─── Select a project ──────────────────────────────────────────────────────
  const selectProject = useCallback(async (projectName, projectId, invitationCode) => {
    if (!projectId || !projectName) {
      console.warn('selectProject called with missing projectId or projectName');
      return;
    }

    // Optional: verify access before selecting (if you want to be extra safe)
    // const hasAccess = await verifyProjectAccess(projectId);
    // if (!hasAccess) {
    //   console.warn('User does not have access to this project');
    //   return;
    // }

    setCurrentProject({
      id: projectId,
      name: projectName,
      invitationCode: invitationCode || null,
      // Store a timestamp for potential expiry logic
      selectedAt: Date.now(),
    });

    // Optionally persist to localStorage for recovery after refresh
    try {
      localStorage.setItem('active_project', JSON.stringify({ id: projectId, name: projectName, invitationCode }));
    } catch (e) { /* ignore */ }
  }, []);

  // ─── Clear project selection ──────────────────────────────────────────────
  const clearProject = useCallback(() => {
    setCurrentProject(null);
    try {
      localStorage.removeItem('active_project');
    } catch (e) { /* ignore */ }
  }, []);

  // ─── Restore project from localStorage on mount ──────────────────────────
  useEffect(() => {
    if (!user || user.role === 'guest') return;
    try {
      const stored = localStorage.getItem('active_project');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id && parsed.name) {
          // We could verify access here, but we'll let the component handle re‑selection
          // Instead, we just set it (the user might still have access, but if not, they'll get an error later)
          setCurrentProject({
            id: parsed.id,
            name: parsed.name,
            invitationCode: parsed.invitationCode || null,
            selectedAt: Date.now(),
          });
        }
      }
    } catch (e) { /* ignore */ }
    setIsLoading(false);
  }, [user]);

  // ─── Invalidate cache (useful after project updates) ──────────────────────
  const invalidateProjectCache = useCallback((projectId) => {
    if (projectId) {
      verificationCache.current.delete(projectId);
    } else {
      verificationCache.current.clear();
    }
  }, []);

  const value = {
    currentProject,
    selectProject,
    clearProject,
    verifyProjectAccess,
    isLoading,
    // Optional: expose cache invalidation if needed
    invalidateProjectCache,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
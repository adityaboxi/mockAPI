import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ProjectContext = createContext();

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentProject, setCurrentProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dedicated environment variable for project verification (add to .env if missing)
  const VERIFY_PROJECT_URL = import.meta.env.VITE_API_URL_VERIFY_PROJECT;

  useEffect(() => {
    if (!user) {
      setCurrentProject(null);
    }
    setIsLoading(false);
  }, [user]);

  const verifyProjectAccess = useCallback(async (projectId) => {
    if (!projectId) return false;
    try {
      const response = await fetch(VERIFY_PROJECT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId })
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }, [VERIFY_PROJECT_URL]);

  const selectProject = useCallback(async (projectName, projectId, invitationCode) => {
    setCurrentProject({ id: projectId, name: projectName, invitationCode });
  }, []);

  const clearProject = useCallback(() => {
    setCurrentProject(null);
  }, []);

  return (
    <ProjectContext.Provider value={{
      currentProject,
      selectProject,
      clearProject,
      verifyProjectAccess,
      isLoading
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
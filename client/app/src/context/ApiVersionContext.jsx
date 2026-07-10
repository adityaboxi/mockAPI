import React, { createContext, useContext, useState } from 'react';

const ApiVersionContext = createContext();

export const useApiVersion = () => {
  const context = useContext(ApiVersionContext);
  if (!context) throw new Error('useApiVersion must be used within ApiVersionProvider');
  return context;
};

export const ApiVersionProvider = ({ children }) => {
  const [currentVersionData, setCurrentVersionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Use the dedied environment variable for API version data endpoint
  const API_VERSION_DATA_URL = import.meta.env.VITE_API_URL_API_VERSION_DATA;

  const loadVersion = async (projectId, username, baseurlpath, version) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_VERSION_DATA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, username, baseurlpath, version })
      });
      if (response.ok) {
        const result = await response.json();
        setCurrentVersionData({ ...result.data });
        return result.data;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load version');
        return null;
      }
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearVersion = () => {
    setCurrentVersionData(null);
    setError(null);
  };

  return (
    <ApiVersionContext.Provider value={{ currentVersionData, loadVersion, clearVersion, loading, error }}>
      {children}
    </ApiVersionContext.Provider>
  );
};
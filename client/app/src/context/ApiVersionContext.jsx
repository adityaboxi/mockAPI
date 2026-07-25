import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * @typedef {Object} ApiVersionData
 * @property {string} protocol - http or https
 * @property {string} method - GET, POST, etc.
 * @property {string} urlPath - The base URL path
 * @property {Array<{key: string, value: string}>} pathParams
 * @property {Array<{key: string, value: string}>} queryParams
 * @property {Array<{key: string, value: string}>} headers
 * @property {Array<{key: string, value: string}>} responseHeaders
 * @property {Array<Object>} cookies
 * @property {boolean} isAuthEnabled
 * @property {string} authScheme
 * @property {number} latency
 * @property {number} rateLimit
 * @property {number} statusCode
 * @property {Object} requestBody
 * @property {Object} responseBody
 * @property {string} actualFullUrl
 * @property {string} expectedToken
 * @property {string} expectedApiKey
 * @property {boolean} airesponse
 */

const ApiVersionContext = createContext();

export const useApiVersion = () => {
  const context = useContext(ApiVersionContext);
  if (!context) {
    throw new Error('useApiVersion must be used within ApiVersionProvider');
  }
  return context;
};

export const ApiVersionProvider = ({ children }) => {
  const [currentVersionData, setCurrentVersionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cache for already-loaded versions (projectId + username + baseurlpath + version)
  const cacheRef = useRef(new Map());
  // Track in-flight requests to prevent duplicates
  const pendingRequestsRef = useRef(new Map());

  const API_VERSION_DATA_URL = import.meta.env.VITE_API_URL_API_VERSION_DATA;

  /**
   * Generate a cache key from the request parameters
   */
  const getCacheKey = useCallback((projectId, username, baseurlpath, version) => {
    return `${projectId}|${username}|${baseurlpath}|${version}`;
  }, []);

  /**
   * Load a specific API version's data
   * @param {string} projectId - The project ID
   * @param {string} username - The user's username
   * @param {string} baseurlpath - The base URL path
   * @param {string} version - The version string (e.g., "v1")
   * @param {Object} options - Optional configuration
   * @param {boolean} options.skipCache - Force a fresh fetch even if cached
   * @returns {Promise<ApiVersionData|null>} The version data or null on error
   */
  const loadVersion = useCallback(async (
    projectId,
    username,
    baseurlpath,
    version,
    options = { skipCache: false }
  ) => {
    // Validate required params
    if (!projectId || !username || !baseurlpath || !version) {
      const err = new Error('Missing required parameters: projectId, username, baseurlpath, and version are required');
      setError(err.message);
      return null;
    }

    const cacheKey = getCacheKey(projectId, username, baseurlpath, version);

    // Return cached data if available and not skipping cache
    if (!options.skipCache && cacheRef.current.has(cacheKey)) {
      const cachedData = cacheRef.current.get(cacheKey);
      setCurrentVersionData(cachedData);
      setError(null);
      return cachedData;
    }

    // If there's already a pending request for this exact version, return that promise
    if (pendingRequestsRef.current.has(cacheKey)) {
      return pendingRequestsRef.current.get(cacheKey);
    }

    setLoading(true);
    setError(null);

    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        const response = await fetch(API_VERSION_DATA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ projectId, username, baseurlpath, version })
        });

        if (!response.ok) {
          let errorMessage = `Failed to load version: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData?.error) errorMessage = errorData.error;
          } catch {
            // If response isn't JSON, use the status text
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        // Validate response structure
        if (!result.data || typeof result.data !== 'object') {
          throw new Error('Invalid response format: missing "data" field');
        }

        const versionData = { ...result.data };

        // Cache the result
        cacheRef.current.set(cacheKey, versionData);

        // Update state
        setCurrentVersionData(versionData);
        setError(null);
        return versionData;

      } catch (err) {
        const errorMessage = err.message || 'Failed to load version data';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
        // Clean up pending request reference
        pendingRequestsRef.current.delete(cacheKey);
      }
    })();

    // Store the pending request
    pendingRequestsRef.current.set(cacheKey, fetchPromise);

    return fetchPromise;
  }, [API_VERSION_DATA_URL, getCacheKey]);

  /**
   * Clear the currently loaded version data and any associated errors
   */
  const clearVersion = useCallback(() => {
    setCurrentVersionData(null);
    setError(null);
  }, []);

  /**
   * Clear the entire cache (useful after significant changes)
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    pendingRequestsRef.current.clear();
  }, []);

  /**
   * Invalidate a specific cache entry
   */
  const invalidateCache = useCallback((projectId, username, baseurlpath, version) => {
    const cacheKey = getCacheKey(projectId, username, baseurlpath, version);
    cacheRef.current.delete(cacheKey);
    pendingRequestsRef.current.delete(cacheKey);
  }, [getCacheKey]);

  const value = {
    currentVersionData,
    loadVersion,
    clearVersion,
    clearCache,
    invalidateCache,
    loading,
    error
  };

  return (
    <ApiVersionContext.Provider value={value}>
      {children}
    </ApiVersionContext.Provider>
  );
};
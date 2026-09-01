// src/context/ApiVersionContext.jsx
import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

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

const ApiVersionContext = createContext(null);

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

  // Cache for already-loaded versions
  const cacheRef = useRef(new Map());
  // Track in-flight requests to prevent duplicates
  const pendingRequestsRef = useRef(new Map());
  // Sequence counter to prevent out-of-order resolution on fast clicks
  const currentRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const API_VERSION_DATA_URL = import.meta.env.VITE_API_URL_API_VERSION_DATA || '/api/api-version-data';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingRequestsRef.current.clear();
    };
  }, []);

  /**
   * Generate a normalized cache key
   */
  const getCacheKey = useCallback((projectId, username, baseurlpath, version) => {
    const cleanPath = (baseurlpath || '').trim().replace(/^\/+|\/+$/g, '');
    return `${projectId}|${username}|${cleanPath}|${version}`;
  }, []);

  /**
   * Load a specific API version's data
   */
  const loadVersion = useCallback(async (
    projectId,
    username,
    baseurlpath,
    version,
    options = { skipCache: false }
  ) => {
    if (!projectId || !username || !baseurlpath || !version) {
      const err = new Error('Missing required parameters: projectId, username, baseurlpath, and version are required');
      if (isMountedRef.current) setError(err.message);
      return null;
    }

    const cacheKey = getCacheKey(projectId, username, baseurlpath, version);
    const requestId = ++currentRequestIdRef.current;

    // Return cached data if available
    if (!options.skipCache && cacheRef.current.has(cacheKey)) {
      const cachedData = cacheRef.current.get(cacheKey);
      if (requestId === currentRequestIdRef.current && isMountedRef.current) {
        setCurrentVersionData(cachedData);
        setError(null);
      }
      return cachedData;
    }

    // In-flight deduplication
    if (pendingRequestsRef.current.has(cacheKey)) {
      const pendingPromise = pendingRequestsRef.current.get(cacheKey);
      const data = await pendingPromise;
      if (requestId === currentRequestIdRef.current && isMountedRef.current && data) {
        setCurrentVersionData(data);
      }
      return data;
    }

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const fetchPromise = (async () => {
      try {
        const result = await apiClient.post(API_VERSION_DATA_URL, {
          projectId,
          username,
          baseurlpath,
          version,
        });

        if (!result.data || typeof result.data !== 'object') {
          throw new Error('Invalid response format: missing "data" field');
        }

        const versionData = { ...result.data };
        cacheRef.current.set(cacheKey, versionData);

        if (requestId === currentRequestIdRef.current && isMountedRef.current) {
          setCurrentVersionData(versionData);
          setError(null);
        }
        return versionData;
      } catch (err) {
        const errorMessage = err.message || 'Failed to load version data';
        if (requestId === currentRequestIdRef.current && isMountedRef.current) {
          setError(errorMessage);
        }
        return null;
      } finally {
        if (requestId === currentRequestIdRef.current && isMountedRef.current) {
          setLoading(false);
        }
        pendingRequestsRef.current.delete(cacheKey);
      }
    })();

    pendingRequestsRef.current.set(cacheKey, fetchPromise);
    return fetchPromise;
  }, [API_VERSION_DATA_URL, getCacheKey]);

  /**
   * Update current in-memory version data optimistically
   */
  const updateCurrentVersionData = useCallback((updater) => {
    setCurrentVersionData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
  }, []);

  /**
   * Clear the currently loaded version data
   */
  const clearVersion = useCallback(() => {
    setCurrentVersionData(null);
    setError(null);
  }, []);

  /**
   * Clear cache
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

  const value = useMemo(() => ({
    currentVersionData,
    loadVersion,
    updateCurrentVersionData,
    clearVersion,
    clearCache,
    invalidateCache,
    loading,
    error,
  }), [
    currentVersionData,
    loadVersion,
    updateCurrentVersionData,
    clearVersion,
    clearCache,
    invalidateCache,
    loading,
    error,
  ]);

  return (
    <ApiVersionContext.Provider value={value}>
      {children}
    </ApiVersionContext.Provider>
  );
};
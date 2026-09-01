// src/services/apiClient.js
// Centralized Unified API Client for High-Performance & Robust Networking

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Normalizes an endpoint URL.
 */
function resolveUrl(endpoint) {
  if (!endpoint) return '/api';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (API_BASE && !cleanEndpoint.startsWith(API_BASE)) {
    return `${API_BASE}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

/**
 * Builds request headers with Content-Type and Authorization Bearer token.
 */
function buildHeaders(customHeaders = {}, isFormData = false) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers = { ...customHeaders };

  // Only default to application/json if not sending FormData
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  } else if (isFormData) {
    delete headers['Content-Type']; // Let the browser set multipart boundary
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Parses response safely (JSON or text).
 */
async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json().catch(() => ({}));
  }
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return text ? { message: text } : {};
  }
}

function formatUserFriendlyError(err, status, data) {
  if (err?.name === 'AbortError') return err;

  let rawMessage =
    (typeof data === 'object' && (data.error || data.message || data.err)) ||
    err?.message ||
    '';

  // Network / Connection drop errors
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('network error') ||
    rawMessage.includes('Load failed')
  ) {
    rawMessage = 'Unable to connect to the server. Please check your network connection and try again.';
  } else if (rawMessage.includes('E11000') || rawMessage.includes('duplicate key')) {
    rawMessage = 'An item or workspace with these details already exists.';
  } else if (rawMessage.includes('jwt expired') || rawMessage.includes('Invalid token')) {
    rawMessage = 'Your session has expired. Please log in again.';
  } else if (status === 401 && !rawMessage) {
    rawMessage = 'Authentication required. Please log in to continue.';
  } else if (status === 403 && !rawMessage) {
    rawMessage = 'You do not have permission to perform this action.';
  } else if (status === 404 && !rawMessage) {
    rawMessage = 'The requested resource was not found.';
  } else if (status === 429) {
    rawMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
  } else if (status >= 500 && (!rawMessage || rawMessage.includes('CastError') || rawMessage.includes('Mongo'))) {
    rawMessage = 'The server is temporarily busy. Please try again in a moment.';
  }

  const userError = new Error(rawMessage || 'An unexpected error occurred. Please try again.');
  userError.status = status || 500;
  userError.data = data || {};
  return userError;
}

// In-Memory Request Deduplication and SWR/TTL Cache
const inFlightRequests = new Map();
const responseCache = new Map();
const DEFAULT_TTL_MS = 10000; // 10s default TTL for GET requests

/**
 * Invalidates cached GET requests matching a pattern, or clears all if omitted.
 */
export function invalidateCache(pattern = '') {
  if (!pattern) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
    }
  }
}

/**
 * Main HTTP request executor with request coalescing, TTL caching, and conditional validation.
 */
async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = resolveUrl(endpoint);
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const cacheKey = `${method}:${url}:${token || 'guest'}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  // 1. Check in-memory cache for GET requests
  const isCacheable = method === 'GET' && options.cache !== false && !options.skipCache;
  const ttl = typeof options.ttl === 'number' ? options.ttl : DEFAULT_TTL_MS;

  if (isCacheable) {
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < ttl) {
      return cachedEntry.data;
    }
  }

  // 2. Coalesce in-flight requests (prevent duplicate concurrent network calls)
  if (isCacheable && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const execute = async () => {
    const headers = buildHeaders(options.headers, isFormData);

    // Conditional request: send ETag if available
    const cachedEntry = responseCache.get(cacheKey);
    if (isCacheable && cachedEntry?.etag) {
      headers['If-None-Match'] = cachedEntry.etag;
    }

    const fetchOptions = {
      method,
      headers,
      credentials: 'include',
      ...options,
    };

    if (options.body && typeof options.body === 'object' && !isFormData) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, fetchOptions);

      // Handle 304 Not Modified
      if (response.status === 304 && cachedEntry) {
        cachedEntry.timestamp = Date.now();
        return cachedEntry.data;
      }

      const data = await parseResponse(response);

      if (!response.ok) {
        if (response.status === 401 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw formatUserFriendlyError(null, response.status, data);
      }

      // Store in memory cache if cacheable
      if (isCacheable && response.ok) {
        const etag = response.headers.get('etag');
        responseCache.set(cacheKey, {
          data,
          etag,
          timestamp: Date.now(),
        });
      }

      // Invalidate cache on mutations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        invalidateCache();
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err.status && err.data) {
        throw err;
      }
      throw formatUserFriendlyError(err, err.status || 0, err.data || null);
    } finally {
      if (isCacheable) {
        inFlightRequests.delete(cacheKey);
      }
    }
  };

  if (isCacheable) {
    const promise = execute();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return execute();
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, bodyOrOptions = {}, options = {}) => {
    if (bodyOrOptions && (bodyOrOptions.body || bodyOrOptions.headers || bodyOrOptions.signal)) {
      return request(endpoint, { ...bodyOrOptions, method: 'DELETE' });
    }
    return request(endpoint, { ...options, method: 'DELETE', body: bodyOrOptions });
  },
  request,
  resolveUrl,
  invalidateCache,
};

export default apiClient;
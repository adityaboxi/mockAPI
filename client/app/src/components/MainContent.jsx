import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";
import { useApiVersion } from "../context/ApiVersionContext";
import { useAuth } from "../context/AuthContext";
import UrlBuilder from "./maincomponentmemo/UrlBuilder";
import PathParamsSection from "./maincomponentmemo/PathParamsSection";
import QueryParamsSection from "./maincomponentmemo/QueryParamsSection";
import RequestResponsePanels from "./maincomponentmemo/RequestResponsePanels";
import Authtokenetc from "./maincomponentmemo/Authtokenetc";


const UPDATE_API_URL = import.meta.env.VITE_API_URL_UPDATE_API;
const ADD_API_URL = import.meta.env.VITE_API_URL_ADD_API;
const ASK_AI_URL = import.meta.env.VITE_API_URL_ASK_AI;
const REVERSE_AI_URL = import.meta.env.VITE_API_URL_REVERSE_AI;
const DOMAIN = import.meta.env.VITE_DOMAIN;
const OTP_TIMER = import.meta.env.VITE_OTP_TIMER;
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ;

const MOCK_API_BASE_URL = import.meta.env.VITE_MOCK_API_BASE_URL;

function MainContent() {
  const { theme } = useTheme();
  const { currentProject } = useProject();
  const { currentVersionData, loadVersion, clearVersion } = useApiVersion();
  const { user } = useAuth();
  const [reverseTimer, setReverseTimer] = useState(0);
  const timerRef = useRef(null);

  // All existing state (unchanged)
  const [protocol, setProtocol] = useState('http');
  const [method, setMethod] = useState('GET');
  const [urlPath, setUrlPath] = useState('');
  const [pathParams, setPathParams] = useState([]);
  const [queryParams, setQueryParams] = useState([]);
  const [showPathParamInput, setShowPathParamInput] = useState(false);
  const [showQueryParamInput, setShowQueryParamInput] = useState(false);
  const [newPathKey, setNewPathKey] = useState('');
  const [newPathValue, setNewPathValue] = useState('');
  const [newQueryKey, setNewQueryKey] = useState('');
  const [newQueryValue, setNewQueryValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [requestBody, setRequestBody] = useState('');
  const [responseBody, setResponseBody] = useState('');
  const [geminiInput, setGeminiInput] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [includeAIResponse, setIncludeAIResponse] = useState(true);
  const [updateStatus, setUpdateStatus] = useState("idle");
  const [newApiStatus, setNewApiStatus] = useState("idle");
  const [isReversing, setIsReversing] = useState(false);
  const [originalPayload, setOriginalPayload] = useState(null);
  const [isAuthEnabled, setIsAuthEnabled] = useState(false);
  const [latency, setLatency] = useState(0);
  const [rateLimit, setRateLimit] = useState(0);
  const [statusCode, setStatusCode] = useState(200);
  const [authScheme, setAuthScheme] = useState("BearerAuth");
  const [headers, setHeaders] = useState([]);
  const [cookies, setCookies] = useState([]);
  const [responseHeaders, setResponseHeaders] = useState([]);

  // Expected token fields
  const [expectedToken, setExpectedToken] = useState('');
  const [expectedApiKey, setExpectedApiKey] = useState('');

  // ✅ New state for curl copy animation
  const [copiedCurl, setCopiedCurl] = useState(false);

  const isWhiteTheme = theme === 'white';
  const w = isWhiteTheme;

  // Refs and helpers
  const timeoutsRef = useRef([]);
  const copyTimeoutRef = useRef(null);

  const safeTimeout = (callback, delay) => {
    const id = setTimeout(() => {
      callback();
      timeoutsRef.current = timeoutsRef.current.filter(t => t !== id);
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      timeoutsRef.current.forEach(clearTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const safeParseJSON = (str) => {
    if (!str || !str.trim()) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  // Helper: check duplicate key (case-insensitive)
  const isKeyDuplicate = (items, key, excludeIndex = -1) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) return false;
    return items.some((item, idx) => idx !== excludeIndex && item.key && item.key.trim().toLowerCase() === normalizedKey);
  };

  // Populate UI when version data changes
  useEffect(() => {
    if (!currentVersionData) return;
    setProtocol(currentVersionData.protocol || 'https');
    setMethod(currentVersionData.method || 'GET');
    setUrlPath(currentVersionData.urlPath || '');
    setIncludeAIResponse(currentVersionData.airesponse === true || currentVersionData.includeAiresponse === true);
    setStatusCode(currentVersionData.statusCode || 200);
    if (currentVersionData.pathParams && Array.isArray(currentVersionData.pathParams)) {
      setPathParams(currentVersionData.pathParams);
    } else if (currentVersionData.pathParameters) {
      setPathParams(Object.entries(currentVersionData.pathParameters).map(([k, v]) => ({ key: k, value: v || '' })));
    } else {
      setPathParams([]);
    }
    if (currentVersionData.queryParams && Array.isArray(currentVersionData.queryParams)) {
      setQueryParams(currentVersionData.queryParams);
    } else if (currentVersionData.queryParameters) {
      setQueryParams(Object.entries(currentVersionData.queryParameters).map(([k, v]) => ({ key: k, value: v || '' })));
    } else {
      setQueryParams([]);
    }
    setRequestBody(currentVersionData.requestBody ? JSON.stringify(currentVersionData.requestBody, null, 2) : '');
    setResponseBody(currentVersionData.responseBody ? JSON.stringify(currentVersionData.responseBody, null, 2) : '');
    setServerUrl(currentVersionData.actualFullUrl || '');
    setIsAuthEnabled(currentVersionData.isAuthEnabled === true);
    setAuthScheme(currentVersionData.authScheme || 'BearerAuth');
    setLatency(currentVersionData.latency || 0);
    setRateLimit(currentVersionData.rateLimit || 0);
    setHeaders(Array.isArray(currentVersionData.headers) ? currentVersionData.headers : []);
    setResponseHeaders(Array.isArray(currentVersionData.responseHeaders) ? currentVersionData.responseHeaders : []);
    setCookies(Array.isArray(currentVersionData.cookies) ? currentVersionData.cookies : []);
    setExpectedToken(currentVersionData.expectedToken || '');
    setExpectedApiKey(currentVersionData.expectedApiKey || '');
  }, [currentVersionData]);

  // Path params extraction
  const extractPathParams = useCallback((path) => {
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = [...path.matchAll(regex)];
    const keys = matches.map(m => m[1]);
    setPathParams(prev => keys.map(key => prev.find(p => p.key === key) || { key, value: '' }));
  }, []);

  const handleUrlPathChange = (e) => {
    const path = e.target.value;
    setUrlPath(path);
    extractPathParams(path);
  };

  const updatePathParam = (key, value) => {
    setPathParams(prev => prev.map(p => p.key === key ? { ...p, value } : p));
  };

  // ✅ FIXED: Add path param – returns true if added, false if duplicate or empty key
  const addPathParam = useCallback(() => {
    const trimmedKey = newPathKey.trim();
    if (!trimmedKey) {
      alert('Please enter a path parameter key.');
      return false;
    }
    if (isKeyDuplicate(pathParams, trimmedKey)) {
      alert(`Path parameter "${trimmedKey}" already exists. Duplicate keys are not allowed.`);
      return false;
    }
    let newPath = urlPath;
    const trimmedValue = newPathValue.trim();
    if (!newPath.includes(`:${trimmedKey}`)) {
      newPath = newPath + (newPath.endsWith('/') ? '' : '/') + `:${trimmedKey}`;
      setUrlPath(newPath);
    }
    setPathParams(prev => {
      const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
      const matches = [...newPath.matchAll(regex)];
      const keys = matches.map(m => m[1]);
      const newParams = keys.map(key => prev.find(p => p.key === key) || { key, value: trimmedValue });
      return newParams.map(p => p.key === trimmedKey ? { ...p, value: trimmedValue } : p);
    });
    setNewPathKey('');
    setNewPathValue('');
    setShowPathParamInput(false);
    return true;
  }, [newPathKey, newPathValue, urlPath, pathParams]);

  const removePathParam = (key) => {
    const newUrlPath = urlPath.replace(new RegExp(`\/?:${key}(?=\/|$)`), '').replace(/\/+/g, '/');
    setUrlPath(newUrlPath);
    extractPathParams(newUrlPath);
  };

  // Query param functions with duplicate check – returns true if added
  const updateQueryParam = useCallback((key, value) => {
    setQueryParams(prev => {
      const existing = prev.find(q => q.key === key);
      if (existing) return prev.map(q => q.key === key ? { ...q, value } : q);
      return [...prev, { key, value }];
    });
  }, []);

  const removeQueryParam = useCallback((key) => {
    setQueryParams(prev => prev.filter(q => q.key !== key));
  }, []);

  // ✅ FIXED: Add query param – returns true if added, false if duplicate or empty
  const addQueryParam = useCallback(() => {
    const trimmedKey = newQueryKey.trim();
    const trimmedValue = newQueryValue.trim();
    if (!trimmedKey || !trimmedValue) {
      alert('Please enter both a key and a value for the query parameter.');
      return false;
    }
    if (isKeyDuplicate(queryParams, trimmedKey)) {
      alert(`Query parameter "${trimmedKey}" already exists. Duplicate keys are not allowed.`);
      return false;
    }
    setQueryParams(prev => [...prev, { key: trimmedKey, value: trimmedValue }]);
    setNewQueryKey('');
    setNewQueryValue('');
    setShowQueryParamInput(false);
    return true;
  }, [newQueryKey, newQueryValue, queryParams]);

  // Generic row handlers (for headers, responseHeaders, cookies)
  const handleAddRow = (setter) => setter(prev => [...prev, { key: "", value: "" }]);
  const handleRemoveRow = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));
  const handleUpdateRow = (setter, idx, field, val) => setter(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  // Cookie handlers
  const handleAddCookie = () => {
    setCookies(prev => [...prev, {
      key: "",
      value: "",
      options: {
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        maxAge: "",
        domain: "",
        path: "/"
      }
    }]);
  };
  const handleUpdateCookieOption = (idx, option, val) => {
    setCookies(prev => prev.map((item, i) => i === idx ? { ...item, options: { ...item.options, [option]: val } } : item));
  };

  // Build final URL
  const buildFinalUrl = () => {
 let finalUrl = MOCK_API_BASE_URL; // ✅ 
    let path = urlPath || '';
    path = path.replace(/[^a-zA-Z0-9/:_-]/g, '');
    path = path.replace(/\/+/g, '/');
    if (path.startsWith('/')) path = path.substring(1);
    if (path.endsWith('/')) path = path.slice(0, -1);
    pathParams.forEach(param => {
      const placeholder = `:${param.key}`;
      let value = param.value || `{${param.key}}`;
      value = value.replace(/[^a-zA-Z0-9_-]/g, '');
      path = path.replace(new RegExp(placeholder, 'g'), value);
    });
    if (path) finalUrl += '/' + path;
    const activeParams = queryParams.filter(q => q.key && q.value);
    if (activeParams.length > 0) {
      const queryStrings = [];
      for (const q of activeParams) {
        let key = q.key.replace(/[^a-zA-Z0-9_]/g, '');
        let value = q.value.replace(/[^a-zA-Z0-9_\-.]/g, '');
        if (key && value) queryStrings.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
      if (queryStrings.length > 0) finalUrl += '?' + queryStrings.join('&');
    }
    return finalUrl;
  };

  const finalUrl = useMemo(() => buildFinalUrl(), [protocol, urlPath, pathParams, queryParams]);

  // OpenAPI JSON (unchanged)
  const openApiJson = useMemo(() => {
    let requestSchema = { type: "object", properties: {} };
    let responseSchema = { type: "object", properties: {} };
    try {
      if (requestBody.trim()) requestSchema = JSON.parse(requestBody);
      if (responseBody.trim()) responseSchema = JSON.parse(responseBody);
    } catch (e) {}
    const compiledParameters = [
      ...pathParams.filter(p => p.key).map(p => ({ name: p.key, in: "path", required: true, schema: { type: "string" } })),
      ...queryParams.filter(q => q.key).map(q => ({ name: q.key, in: "query", required: false, schema: { type: "string" } })),
      ...headers.filter(h => h.key).map(h => ({ name: h.key, in: "header", required: true, schema: { type: "string" } })),
      ...cookies.filter(c => c.key).map(c => ({ name: c.key, in: "cookie", required: true, schema: { type: "string" } }))
    ];
    const compiledResponseHeaders = {};
    responseHeaders.forEach(h => {
      if (h.key) {
        compiledResponseHeaders[h.key] = {
          schema: { type: "string" },
          ...(h.value && { description: `Example value: ${h.value}` })
        };
      }
    });
    let formattedPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
    pathParams.forEach(p => {
      if (p.key) formattedPath = formattedPath.replace(`:${p.key}`, `{${p.key}}`);
    });
    return {
      openapi: "3.0.3",
      info: { title: currentProject?.name || "Dynamic API Asset Workspace", description: "Auto-compiled specification documentation.", version: "1.0.0" },
      servers: [{ url: `${protocol}://${DOMAIN}` }],
      paths: {
        [formattedPath]: {
          [method.toLowerCase()]: {
            summary: "Auto-updated route specification",
            "x-latency": latency,
            "x-rate-limit": rateLimit,
            ...(isAuthEnabled && { security: [{ [authScheme]: [] }] }),
            ...(compiledParameters.length > 0 && { parameters: compiledParameters }),
            ...(method !== "GET" && {
              requestBody: { required: true, content: { "application/json": { schema: requestSchema } } }
            }),
            responses: {
              "200": {
                description: "Successful response blueprint",
                ...(Object.keys(compiledResponseHeaders).length > 0 && { headers: compiledResponseHeaders }),
                content: { "application/json": { schema: responseSchema } }
              }
            }
          }
        }
      },
      ...(isAuthEnabled && {
        components: {
          securitySchemes: {
            BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" }
          }
        }
      })
    };
  }, [currentProject, protocol, method, urlPath, pathParams, queryParams, headers, cookies, responseHeaders, isAuthEnabled, authScheme, latency, rateLimit, requestBody, responseBody]);

  const copyToClipboard = async () => {
    const urlToCopy = currentVersionData?.actualFullUrl;
    if (!urlToCopy) return;
    await navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const resetStatus = (setter) => setter("idle");

  // Update API (unchanged)
  const updateAPI = async () => {
    if (updateStatus === "loading" || updateStatus === "success") return;
    setUpdateStatus("loading");

    const project_id = currentProject?.id;
    const urlpath = urlPath;
    if (!project_id || !urlpath) {
      setUpdateStatus("error");
      safeTimeout(() => resetStatus(setUpdateStatus), 2000);
      return;
    }

    let parsedRequestBody = null, parsedResponseBody = null;
    try {
      if (requestBody.trim()) parsedRequestBody = JSON.parse(requestBody);
      if (responseBody.trim()) parsedResponseBody = JSON.parse(responseBody);
    } catch {
      setUpdateStatus("error");
      safeTimeout(() => resetStatus(setUpdateStatus), 2000);
      return;
    }

    const apihistorydata = {
      protocol, method, pathParams, queryParams, headers, responseHeaders, cookies,
      isAuthEnabled, authScheme, latency, rateLimit, statusCode,
      requestBody: parsedRequestBody, responseBody: parsedResponseBody,
      expectedToken, expectedApiKey
    };

    try {
      const response = await fetch(UPDATE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_id, urlpath, apihistorydata, airesponse: includeAIResponse })
      });
      const data = await response.json();
      if (response.ok) {
        setServerUrl(data.actualFullUrl);
        if (data.version && user?.username) {
          await loadVersion(project_id, user.username, urlpath, data.version);
        }
        setUpdateStatus("success");
        safeTimeout(() => resetStatus(setUpdateStatus), 2000);
      } else {
        setUpdateStatus("error");
        safeTimeout(() => resetStatus(setUpdateStatus), 2000);
      }
    } catch {
      setUpdateStatus("error");
      safeTimeout(() => resetStatus(setUpdateStatus), 2000);
    }
  };

  // New API (unchanged)
  const handleNewAPI = async () => {
    if (newApiStatus === "loading" || newApiStatus === "success" || newApiStatus === "exists") return;
    setNewApiStatus("loading");

    const project_id = currentProject?.id;
    const urlpath = urlPath;
    if (!project_id || !urlpath) {
      setNewApiStatus("error");
      safeTimeout(() => resetStatus(setNewApiStatus), 2000);
      return;
    }

    let parsedRequestBody = null, parsedResponseBody = null;
    try {
      if (requestBody.trim()) parsedRequestBody = JSON.parse(requestBody);
      if (responseBody.trim()) parsedResponseBody = JSON.parse(responseBody);
    } catch {
      setNewApiStatus("error");
      safeTimeout(() => resetStatus(setNewApiStatus), 2000);
      return;
    }

    const apihistorydata = {
      protocol, method, pathParams, queryParams, headers, responseHeaders, cookies,
      isAuthEnabled, authScheme, latency, rateLimit, statusCode,
      requestBody: parsedRequestBody, responseBody: parsedResponseBody,
      expectedToken, expectedApiKey
    };

    try {
      const response = await fetch(ADD_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ project_id, urlpath, apihistorydata, airesponse: includeAIResponse })
      });
      const data = await response.json();

      if (response.ok) {
        setServerUrl(data.actualFullUrl);
        if (user?.username) {
          await loadVersion(project_id, user.username, urlpath, 'v1');
        }
        setNewApiStatus("success");
        safeTimeout(() => resetStatus(setNewApiStatus), 2000);
      } else {
        if (response.status === 409 || (data.error && data.error.toLowerCase().includes("already"))) {
          setNewApiStatus("exists");
        } else {
          setNewApiStatus("error");
        }
        safeTimeout(() => resetStatus(setNewApiStatus), 2000);
      }
    } catch {
      setNewApiStatus("error");
      safeTimeout(() => resetStatus(setNewApiStatus), 2000);
    }
  };

  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAskAi = async () => {
    const parsedRequestBody = safeParseJSON(requestBody);
    const parsedResponseBody = safeParseJSON(responseBody);
    const payload = {
      protocol, method, urlPath, pathParams, queryParams,
      requestBody: parsedRequestBody, responseBody: parsedResponseBody,
      isAuthEnabled, authScheme, latency, rateLimit, headers, responseHeaders, cookies,
      includeAIResponse, statusCode, geminiInput
    };
    setGeminiInput('');
    setOriginalPayload(payload);
    setIsAiLoading(true);
    try {
      const askUrl = ASK_AI_URL;
      const response = await fetch(askUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('AI request failed');
      const result = await response.json();
      setProtocol(result.protocol || 'https');
      setMethod(result.method || 'GET');
      setUrlPath(result.urlPath || '');
      setPathParams(result.pathParams || []);
      setQueryParams(result.queryParams || []);
      setRequestBody(result.requestBody ? JSON.stringify(result.requestBody, null, 2) : '');
      setResponseBody(result.responseBody ? JSON.stringify(result.responseBody, null, 2) : '');
      setIsAuthEnabled(result.isAuthEnabled || false);
      setAuthScheme(result.authScheme || 'BearerAuth');
      setLatency(result.latency || 0);
      setRateLimit(result.rateLimit || 0);
      setHeaders(result.headers || []);
      setResponseHeaders(result.responseHeaders || []);
      setCookies(result.cookies || []);
      setIncludeAIResponse(result.includeAIResponse || false);
      if (timerRef.current) clearInterval(timerRef.current);
      setReverseTimer(OTP_TIMER);
      timerRef.current = setInterval(() => {
        setReverseTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setOriginalPayload(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      // silent fail
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleReverseAi = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setReverseTimer(0);
    if (!originalPayload) {
      alert('No previous AI suggestion to revert');
      return;
    }
    setIsReversing(true);
    try {
      const reverseUrl = REVERSE_AI_URL;
      const response = await fetch(reverseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(originalPayload)
      });
      const result = await response.json();
      if (result.previousData) {
        const prev = result.previousData;
        setProtocol(prev.protocol || 'https');
        setMethod(prev.method || 'GET');
        setUrlPath(prev.urlPath || '');
        setPathParams(prev.pathParams || []);
        setQueryParams(prev.queryParams || []);
        setRequestBody(prev.requestBody ? JSON.stringify(prev.requestBody, null, 2) : '');
        setResponseBody(prev.responseBody ? JSON.stringify(prev.responseBody, null, 2) : '');
        setIsAuthEnabled(prev.isAuthEnabled || false);
        setAuthScheme(prev.authScheme || 'BearerAuth');
        setLatency(prev.latency || 0);
        setRateLimit(prev.rateLimit || 0);
        setHeaders(prev.headers || []);
        setResponseHeaders(prev.responseHeaders || []);
        setCookies(prev.cookies || []);
        setIncludeAIResponse(prev.includeAIResponse || false);
        setOriginalPayload(null);
      } else {
        alert('Could not retrieve previous data (maybe expired)');
      }
    } catch (error) {
      console.error('Reverse AI error:', error);
      alert('Failed to revert AI suggestion');
    } finally {
      setIsReversing(false);
    }
  };

  const handleStatusCodeChange = (e) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
      setStatusCode('');
      return;
    }
    const num = Number(rawValue);
    if (!isNaN(num)) {
      setStatusCode(num);
    }
  };

  const handleStatusCodeBlur = () => {
    let num = statusCode === '' ? 200 : Number(statusCode);
    if (isNaN(num)) num = 200;
    num = Math.min(599, Math.max(100, num));
    setStatusCode(num);
  };

  // ---------- Generate cURL command (LIVE) ----------
  // ---------- Generate cURL command (LIVE) ----------
const generateCurlCommand = useCallback(() => {
    // Use the actual deployed URL if available, otherwise use the preview URL
    const targetUrl = currentVersionData?.actualFullUrl || finalUrl;
    if (!targetUrl) return '';

    let curl = `curl -X ${method} "${targetUrl}"`;

    const allHeaders = [...headers];

    // Add auth header if enabled
    if (isAuthEnabled) {
      if (authScheme === 'BearerAuth' && expectedToken) {
        allHeaders.push({ key: 'Authorization', value: `Bearer ${expectedToken}` });
      } else if (authScheme === 'ApiKeyAuth' && expectedApiKey) {
        allHeaders.push({ key: 'X-API-Key', value: expectedApiKey });
      }
    }

    // Add Content-Type if body is present and not already set
    if (requestBody && requestBody.trim()) {
      const hasContentType = allHeaders.some(h => h.key.toLowerCase() === 'content-type');
      if (!hasContentType) {
        allHeaders.push({ key: 'Content-Type', value: 'application/json' });
      }
    }
      // Append all headers
    allHeaders.forEach(({ key, value }) => {
      if (key && value) {
        const safeValue = value.replace(/"/g, '\\"');
        curl += ` -H "${key}: ${safeValue}"`;
      }
    });

    // Append cookies
    const cookiePairs = cookies
      .filter(c => c.key && c.value)
      .map(c => `${c.key}=${c.value}`);
    if (cookiePairs.length > 0) {
      curl += ` -H "Cookie: ${cookiePairs.join('; ')}"`;
    }

    // Append request body
    if (requestBody && requestBody.trim()) {
      const escapedBody = requestBody.replace(/'/g, "'\\''");
      curl += ` -d '${escapedBody}'`;
    }

    return curl;
  }, [method, currentVersionData?.actualFullUrl, finalUrl, headers, cookies, isAuthEnabled, authScheme, expectedToken, expectedApiKey, requestBody]);



 const handleCopyCurl = useCallback(() => {
  const curl = generateCurlCommand();
  if (!curl) return;

  // Fallback for HTTP (clipboard API unavailable)
  const copyToClipboardFallback = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopiedCurl(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedCurl(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Failed to copy cURL command. Please copy manually.');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  // Try clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(curl)
      .then(() => {
        setCopiedCurl(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopiedCurl(false), 2000);
      })
      .catch(() => {
        // Fallback if clipboard API fails
        copyToClipboardFallback(curl);
      });
  } else {
    // Clipboard API not available – use fallback
    copyToClipboardFallback(curl);
  }
}, [generateCurlCommand]);

  // Style helpers
  const border = w ? "border border-gray-200" : "border border-zinc-700/50";
  const panel = w ? `bg-white ${border}` : `bg-[#1e1e24] ${border}`;
  const panelHdr = w ? "bg-gray-50 border-b border-gray-200 text-gray-500" : "bg-[#2b2d31] border-b border-zinc-700/50 text-gray-400";
  const inp = w ? "bg-white border border-gray-300 text-gray-800 placeholder-gray-400" : "bg-[#2b2d31] border border-zinc-700/50 text-gray-200 placeholder-zinc-500";
  const labelTxt = w ? "text-gray-500" : "text-gray-400";
  const mutedTxt = w ? "text-gray-400" : "text-gray-500";
  const miniBtn = w ? "bg-gray-100 hover:bg-gray-200 text-gray-500 border border-gray-200" : "bg-zinc-800 hover:bg-zinc-700 text-gray-400 border border-zinc-700/50";

  const renderButtonContent = (status, text) => {
    if (status === "loading") {
      return (
        <div className="flex items-center justify-center w-full h-full min-w-12.5">
          <svg className="animate-spin h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      );
    }
    if (status === "success") return <div className="flex items-center justify-center w-full h-full text-green-500 font-bold scale-110">✓</div>;
    if (status === "exists") return <span className="text-amber-500 whitespace-nowrap">Already Present</span>;
    if (status === "error") return <span className="text-red-500">Error</span>;
    return text;
  };

  return (
    <main className={`w-full h-full overflow-hidden flex flex-col min-w-0 ${w ? "bg-white" : "bg-[#1e1f22]"}`}>
      <div className={`px-4 py-2 text-xs font-medium shrink-0 border-b select-none ${w ? "text-gray-400 bg-white border-gray-200" : "text-gray-500 bg-[#1e1f22] border-zinc-700/50"}`}>
        API Builder
      </div>

      <div className={`flex-1 h-full overflow-y-auto px-6 py-6 transition-colors duration-150
        ${isWhiteTheme ? "bg-white text-gray-800" : "bg-[#1e1e24] text-gray-300"}
        scrollbar-thin
        ${isWhiteTheme
          ? "[&::-webkit-scrollbar-track]:bg-white [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300"
          : "[&::-webkit-scrollbar-track]:bg-[#1e1e24] [&::-webkit-scrollbar-thumb]:bg-zinc-700/40 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600/60"
        }`}
      >
        <UrlBuilder
          protocol={protocol}
          setProtocol={setProtocol}
          method={method}
          setMethod={setMethod}
          urlPath={urlPath}
          setUrlPath={handleUrlPathChange}
          finalUrl={finalUrl}
          actualFullUrl={currentVersionData?.actualFullUrl || ''}
          copied={copied}
          copyToClipboard={copyToClipboard}
          mutedTxt={mutedTxt}
          inp={inp}
          miniBtn={miniBtn}
          w={w}
        />

        <div className={`px-4 py-2 border-b flex items-center gap-6 flex-wrap shrink-0 ${w ? "bg-gray-50/40" : "bg-[#1a1b1e]/30"}`}>
          <Authtokenetc
            isAuthEnabled={isAuthEnabled}
            setIsAuthEnabled={setIsAuthEnabled}
            latency={latency}
            setLatency={setLatency}
            rateLimit={rateLimit}
            setRateLimit={setRateLimit}
            authScheme={authScheme}
            setAuthScheme={setAuthScheme}
            w={w}
            mutedTxt={mutedTxt}
            inp={inp}
          />

          {isAuthEnabled && authScheme === 'BearerAuth' && (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${labelTxt}`}>Expected Bearer token:</span>
              <input
                type="text"
                value={expectedToken}
                onChange={(e) => setExpectedToken(e.target.value)}
                placeholder="Leave empty to accept any"
                className={`px-2 py-0.5 text-xs rounded ${inp}`}
              />
            </div>
          )}
          {isAuthEnabled && authScheme === 'ApiKeyAuth' && (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${labelTxt}`}>Expected API Key:</span>
              <input
                type="text"
                value={expectedApiKey}
                onChange={(e) => setExpectedApiKey(e.target.value)}
                placeholder="Leave empty to accept any"
                className={`px-2 py-0.5 text-xs rounded ${inp}`}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${labelTxt}`}>Status Code:</span>
            <input
              type="number"
              value={statusCode === '' ? '' : statusCode}
              onChange={handleStatusCodeChange}
              onBlur={handleStatusCodeBlur}
              min="100"
              max="599"
              className={`w-16 px-2 py-0.5 text-xs rounded text-right ${inp}`}
            />
          </div>
        </div>

        <div className={`flex flex-col md:grid md:grid-cols-2 gap-0 border-b shrink-0 ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
          <PathParamsSection
            pathParams={pathParams}
            updatePathParam={updatePathParam}
            setPathParams={setPathParams}
            showPathParamInput={showPathParamInput}
            setShowPathParamInput={setShowPathParamInput}
            newPathKey={newPathKey}
            setNewPathKey={setNewPathKey}
            newPathValue={newPathValue}
            setNewPathValue={setNewPathValue}
            addPathParam={addPathParam}
            removePathParam={removePathParam}
            labelTxt={labelTxt}
            miniBtn={miniBtn}
            inp={inp}
            mutedTxt={mutedTxt}
            w={w}
          />
          <QueryParamsSection
            queryParams={queryParams}
            updateQueryParam={updateQueryParam}
            removeQueryParam={removeQueryParam}
            showQueryParamInput={showQueryParamInput}
            setShowQueryParamInput={setShowQueryParamInput}
            newQueryKey={newQueryKey}
            setNewQueryKey={setNewQueryKey}
            newQueryValue={newQueryValue}
            setNewQueryValue={setNewQueryValue}
            addQueryParam={addQueryParam}
            labelTxt={labelTxt}
            miniBtn={miniBtn}
            inp={inp}
            mutedTxt={mutedTxt}
            w={w}
          />
        </div>

        <div className={`flex flex-col md:grid md:grid-cols-2 gap-0 border-b shrink-0 ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
    
          <div className={`p-3 flex flex-col gap-2 border-b md:border-b-0 md:border-r ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${labelTxt}`}>Request Headers ({headers.length})</span>
              <button onClick={() => handleAddRow(setHeaders)} className={`text-[11px] font-medium px-2 py-0.5 rounded ${miniBtn}`}>+ Add Header</button>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {headers.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.key}
                    placeholder="X-Request-Id"
                    onChange={(e) => {
                      const newKey = e.target.value;
                      if (isKeyDuplicate(headers, newKey, idx)) {
                        alert(`Request header "${newKey}" already exists. Duplicate keys are not allowed.`);
                        return;
                      }
                      handleUpdateRow(setHeaders, idx, "key", newKey);
                    }}
                    className={`w-1/3 px-2 py-0.5 text-xs rounded font-mono outline-none ${inp}`}
                  />
                  <input
                    type="text"
                    value={item.value}
                    placeholder="Value"
                    onChange={(e) => handleUpdateRow(setHeaders, idx, "value", e.target.value)}
                    className={`flex-1 px-2 py-0.5 text-xs rounded font-mono outline-none ${inp}`}
                  />
                  <button onClick={() => handleRemoveRow(setHeaders, idx)} className="text-zinc-500 hover:text-rose-400 text-xs px-1">✕</button>
                </div>
              ))}
              {headers.length === 0 && <span className={`text-xs italic ${mutedTxt} block pt-1`}>No request headers compiled.</span>}
            </div>
          </div>

   
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${labelTxt}`}>Response Headers ({responseHeaders.length})</span>
              <button onClick={() => handleAddRow(setResponseHeaders)} className={`text-[11px] font-medium px-2 py-0.5 rounded ${miniBtn}`}>+ Add Header</button>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {responseHeaders.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.key}
                    placeholder="Access-Control-Allow-Origin"
                    onChange={(e) => {
                      const newKey = e.target.value;
                      if (isKeyDuplicate(responseHeaders, newKey, idx)) {
                        alert(`Response header "${newKey}" already exists. Duplicate keys are not allowed.`);
                        return;
                      }
                      handleUpdateRow(setResponseHeaders, idx, "key", newKey);
                    }}
                    className={`w-1/3 px-2 py-0.5 text-xs rounded font-mono outline-none ${inp}`}
                  />
                  <input
                    type="text"
                    value={item.value}
                    placeholder="value or *"
                    onChange={(e) => handleUpdateRow(setResponseHeaders, idx, "value", e.target.value)}
                    className={`flex-1 px-2 py-0.5 text-xs rounded font-mono outline-none ${inp}`}
                  />
                  <button onClick={() => handleRemoveRow(setResponseHeaders, idx)} className="text-zinc-500 hover:text-rose-400 text-xs px-1">✕</button>
                </div>
              ))}
              {responseHeaders.length === 0 && <span className={`text-xs italic ${mutedTxt} block pt-1`}>No custom response headers attached.</span>}
            </div>
          </div>
        </div>

        <div className={`flex flex-col md:grid md:grid-cols-2 gap-0 border-b shrink-0 ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
 
          <div className={`p-3 flex flex-col gap-2 border-b md:border-b-0 md:border-r ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${labelTxt}`}>Stateful Cookies ({cookies.length})</span>
              <button onClick={handleAddCookie} className={`text-[11px] font-medium px-2 py-0.5 rounded ${miniBtn}`}>+ Add Cookie</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {cookies.map((cookie, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-2 rounded border border-zinc-700/50 bg-opacity-20">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cookie.key}
                      placeholder="Name"
                      onChange={(e) => {
                        const newKey = e.target.value;
                        if (isKeyDuplicate(cookies, newKey, idx)) {
                          alert(`Cookie "${newKey}" already exists. Duplicate keys are not allowed.`);
                          return;
                        }
                        handleUpdateRow(setCookies, idx, "key", newKey);
                      }}
                      className={`flex-1 px-2 py-0.5 text-xs rounded font-mono outline-none ${inp}`}
                    />
                    <input
                      type="text"
                      value={cookie.value}
                      placeholder="Value"
                      onChange={(e) => handleUpdateRow(setCookies, idx, "value", e.target.value)}
                      className={`flex-1 px-2 py-0.5 text-xs rounded font-mono outline-none ${inp}`}
                    />
                    <button onClick={() => handleRemoveRow(setCookies, idx)} className="text-zinc-500 hover:text-rose-400 text-xs px-1">✕</button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center text-[10px]">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={cookie.options?.httpOnly || false} onChange={(e) => handleUpdateCookieOption(idx, 'httpOnly', e.target.checked)} /> HttpOnly
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={cookie.options?.secure || false} onChange={(e) => handleUpdateCookieOption(idx, 'secure', e.target.checked)} /> Secure
                    </label>
                    <select value={cookie.options?.sameSite || 'Lax'} onChange={(e) => handleUpdateCookieOption(idx, 'sameSite', e.target.value)} className={`text-xs rounded px-1 py-0.5 ${inp}`}>
                      <option value="Strict">Strict</option>
                      <option value="Lax">Lax</option>
                      <option value="None">None</option>
                    </select>
                    <input type="number" placeholder="MaxAge (s)" value={cookie.options?.maxAge || ''} onChange={(e) => handleUpdateCookieOption(idx, 'maxAge', e.target.value === '' ? '' : Number(e.target.value))} className={`w-20 px-1 py-0.5 text-xs rounded ${inp}`} />
                    <input type="text" placeholder="Domain" value={cookie.options?.domain || ''} onChange={(e) => handleUpdateCookieOption(idx, 'domain', e.target.value)} className={`w-24 px-1 py-0.5 text-xs rounded ${inp}`} />
                    <input type="text" placeholder="Path" value={cookie.options?.path || '/'} onChange={(e) => handleUpdateCookieOption(idx, 'path', e.target.value)} className={`w-16 px-1 py-0.5 text-xs rounded ${inp}`} />
                  </div>
                </div>
              ))}
              {cookies.length === 0 && <span className={`text-xs italic ${mutedTxt} block pt-1`}>No tracking cookies attached.</span>}
            </div>
          </div>

          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${labelTxt}`}>🧪 test-with-curl</span>
              <button
                onClick={handleCopyCurl}
                className={`text-[11px] font-medium px-2 py-0.5 rounded ${miniBtn}`}
                disabled={!finalUrl && !currentVersionData?.actualFullUrl}
              >
                {copiedCurl ? (
                  <span className="text-green-400 flex items-center gap-1">✓ Copied</span>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
            <div className="relative">
              <pre className={`text-xs font-mono p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap break-all ${w ? "bg-gray-50 border border-gray-200 text-gray-800" : "bg-[#0d0d0f] border border-zinc-700/50 text-gray-300"}`}>
                {finalUrl || currentVersionData?.actualFullUrl ? (
                  generateCurlCommand()
                ) : (
                  <span className="text-amber-400 italic">💡 Fill in the API details to generate a test curl command.</span>
                )}
              </pre>
            </div>
          </div>
        </div>

        <div className="p-4 shrink-0">
          <RequestResponsePanels
            requestBody={requestBody}
            setRequestBody={setRequestBody}
            responseBody={responseBody}
            setResponseBody={setResponseBody}
            panel={panel}
            panelHdr={panelHdr}
            w={w}
          />
        </div>
      </div>

      <div className={`shrink-0 border-t z-20 flex flex-col relative block ${w ? "border-gray-200 bg-white" : "border-zinc-700/50 bg-[#1e1f22]"}`}>
        <div className={`flex items-center justify-between px-3 py-2 border-b text-xs shrink-0 h-12 ${w ? "border-gray-200 bg-gray-50" : "border-zinc-700/50 bg-[#1a1b1e]"}`}>
          <span className="text-blue-400 font-medium flex items-center gap-1.5 select-none"><span>✦</span> Ask MockAPI Ai</span>
          <button
            type="button"
            onClick={handleReverseAi}
            disabled={isReversing || !originalPayload || reverseTimer === 0}
            className="text-blue-400 font-medium flex items-center gap-1.5 hover:underline disabled:opacity-50"
          >
            {isReversing ? (
              <div className="flex items-center gap-1">
                <svg className="animate-spin h-3 w-3 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Reverting...</span>
              </div>
            ) : (
              <><span>↺</span> Reverse AI suggestion</>
            )}
            {reverseTimer > 0 && (
              <span className="text-xs text-gray-400 ml-2">
                ({Math.floor(reverseTimer / 60)}:{String(reverseTimer % 60).padStart(2, '0')})
              </span>
            )}
          </button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-end gap-3 mb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`text-xs ${w ? "text-gray-600" : "text-gray-400"}`}>Include AI Response</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={includeAIResponse}
                    onChange={(e) => setIncludeAIResponse(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors ${includeAIResponse ? "bg-blue-600" : w ? "bg-gray-300" : "bg-zinc-700"}`}></div>
                  <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${includeAIResponse ? "translate-x-4" : ""}`}></div>
                </div>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={updateAPI} disabled={updateStatus === "loading"} className={`px-3 py-0.5 min-h-5.5 min-w-22.5 rounded text-xs font-medium transition-colors border flex items-center justify-center ${w ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"}`}>
                {renderButtonContent(updateStatus, "Update")}
              </button>
              <button onClick={handleNewAPI} disabled={newApiStatus === "loading"} className={`px-3 py-0.5 min-h-5.5 min-w-22.5 rounded text-xs font-medium transition-colors border flex items-center justify-center ${w ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"}`}>
                {renderButtonContent(newApiStatus, "New API")}
              </button>
            </div>
          </div>
        </div>
        <div className="relative w-full h-24 shrink-0 block overflow-visible z-10">
          <textarea value={geminiInput} onChange={(e) => setGeminiInput(e.target.value)} className={`w-full h-full px-3 pt-3 pb-12 resize-none outline-none text-sm block relative z-0 ${w ? "bg-white text-gray-800 placeholder-gray-400 focus:border-gray-300" : "bg-[#1e1f22] text-gray-300 placeholder-zinc-600 focus:border-zinc-700"}`} placeholder="Ask MockAPI Ai for API URL and request/response structure..." spellCheck="false" />
          <button
            type="button"
            onClick={handleAskAi}
            disabled={isAiLoading}
            className="absolute bottom-3 right-3 z-30 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold tracking-wide transition-all shadow-md active:scale-95 select-none focus:outline-none disabled:opacity-60"
          >
            {isAiLoading ? (
              <div className="flex items-center gap-1">
                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Thinking...</span>
              </div>
            ) : (
              "Ask AI ✦"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

export default MainContent;
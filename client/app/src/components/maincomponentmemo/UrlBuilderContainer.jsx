// src/components/maincomponentmemo/UrlBuilderContainer.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import UrlBuilder from "./UrlBuilder";
import PathParamsSection from "./PathParamsSection";
import QueryParamsSection from "./QueryParamsSection";

const UrlBuilderContainer = React.memo(({
  protocol, setProtocol,
  method, setMethod,
  queryParams, updateQueryParam, removeQueryParam,
  showQueryParamInput, setShowQueryParamInput,
  newQueryKey, setNewQueryKey,
  newQueryValue, setNewQueryValue,
  addQueryParam,
  labelTxt, miniBtn, inp, mutedTxt, w
}) => {
  const [urlPath, setUrlPath] = useState("");
  const [pathParams, setPathParams] = useState([]);
  const [showPathParamInput, setShowPathParamInput] = useState(false);
  const [newPathKey, setNewPathKey] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const extractPathParams = useCallback((path) => {
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = [...path.matchAll(regex)];
    const keys = matches.map((m) => m[1]);
    const newParams = keys.map((key) => ({ key, value: "" }));
    setPathParams(newParams);
  }, []);

  const handleUrlPathChange = useCallback((e) => {
    const path = e.target.value;
    setUrlPath(path);
    extractPathParams(path);
  }, [extractPathParams]);

  const updatePathParam = useCallback((key, value) => {
    setPathParams((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
  }, []);

  const removePathParam = useCallback((key) => {
    const newPath = urlPath.replace(new RegExp(`\/?:${key}(?=\/|$)`), '').replace(/\/+/g, '/');
    setUrlPath(newPath);
    extractPathParams(newPath);
  }, [urlPath, extractPathParams]);

  const addPathParamHandler = useCallback(() => {
    const trimmedKey = newPathKey.trim();
    if (trimmedKey) {
      let currentPath = urlPath;
      if (!currentPath.includes(`:${trimmedKey}`)) {
        currentPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + `:${trimmedKey}`;
        setUrlPath(currentPath);
        extractPathParams(currentPath);
      }
      setPathParams((prev) => [...prev, { key: trimmedKey, value: newPathValue.trim() }]);
      setNewPathKey('');
      setNewPathValue('');
      setShowPathParamInput(false);
      return true;
    }
    return false;
  }, [newPathKey, newPathValue, urlPath, extractPathParams]);

  const finalUrl = useMemo(() => {
    let base = `${protocol || 'http'}://api.localhost`;
    let path = urlPath || '';
    pathParams.forEach((param) => {
      path = path.replace(`:${param.key}`, param.value || `{${param.key}}`);
    });
    if (path && !path.startsWith('/')) path = '/' + path;
    base += path;

    const activeParams = (queryParams || []).filter((q) => q.key && q.value);
    if (activeParams.length > 0) {
      base += '?' + activeParams.map((q) =>
        `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`
      ).join('&');
    }
    return base;
  }, [protocol, urlPath, pathParams, queryParams]);

  const copyToClipboard = useCallback(async () => {
    const triggerSuccess = () => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(finalUrl);
        triggerSuccess();
        return;
      } catch (_) {}
    }

    const textarea = document.createElement("textarea");
    textarea.value = finalUrl;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      triggerSuccess();
    } catch (_) {
    } finally {
      document.body.removeChild(textarea);
    }
  }, [finalUrl]);

  // Theme-aware styles
  const borderColor = w ? "border-gray-200" : "border-zinc-800";
  const cardBg = w ? "bg-white" : "bg-zinc-900";
  const shadow = w ? "shadow-sm" : "shadow-none";

  return (
    <div className={`rounded-xl ${cardBg} ${borderColor} ${shadow} border overflow-hidden`}>
      {/* UrlBuilder section */}
      <UrlBuilder
        protocol={protocol}
        setProtocol={setProtocol}
        method={method}
        setMethod={setMethod}
        urlPath={urlPath}
        setUrlPath={handleUrlPathChange}
        finalUrl={finalUrl}
        copied={copied}
        copyToClipboard={copyToClipboard}
        mutedTxt={mutedTxt}
        inp={inp}
        miniBtn={miniBtn}
        w={w}
      />

      {/* Path & Query parameters */}
      <div className={`grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x ${borderColor}`}>
        <div className="p-4">
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
            addPathParam={addPathParamHandler}
            removePathParam={removePathParam}
            labelTxt={labelTxt}
            miniBtn={miniBtn}
            inp={inp}
            mutedTxt={mutedTxt}
            w={w}
          />
        </div>
        <div className="p-4">
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
      </div>
    </div>
  );
});

UrlBuilderContainer.displayName = "UrlBuilderContainer";

export default UrlBuilderContainer;
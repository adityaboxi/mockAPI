// src/components/maincomponentmemo/UrlPathInputWithParams.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import UrlBuilder from "./UrlBuilder";
import PathParamsSection from "./PathParamsSection";

const UrlPathInputWithParams = React.memo(({ protocol, method, onUrlChange, w, inp, mutedTxt, miniBtn, labelTxt }) => {
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
    return newParams;
  }, []);

  const handleUrlPathChange = useCallback((e) => {
    const path = e.target.value;
    setUrlPath(path);
    const params = extractPathParams(path);
    onUrlChange?.(path, params);
  }, [extractPathParams, onUrlChange]);

  const updatePathParam = useCallback((key, value) => {
    setPathParams((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
  }, []);

  const removePathParam = useCallback((key) => {
    const newPath = urlPath.replace(new RegExp(`\/?:${key}(?=\/|$)`), '').replace(/\/+/g, '/');
    setUrlPath(newPath);
    extractPathParams(newPath);
  }, [urlPath, extractPathParams]);

  const addPathParam = useCallback(() => {
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

  const buildFinalUrl = useCallback(() => {
    let finalUrl = `${protocol || 'http'}://api.localhost`;
    let path = urlPath || '';
    pathParams.forEach((param) => {
      path = path.replace(`:${param.key}`, param.value || `{${param.key}}`);
    });
    if (path && !path.startsWith('/')) path = '/' + path;
    finalUrl += path;
    return finalUrl;
  }, [protocol, urlPath, pathParams]);

  const copyToClipboard = useCallback(async () => {
    const url = buildFinalUrl();
    const triggerSuccess = () => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        triggerSuccess();
        return;
      } catch (_) {}
    }

    const textarea = document.createElement("textarea");
    textarea.value = url;
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
  }, [buildFinalUrl]);

  const finalUrl = buildFinalUrl();
  const borderColor = w ? "border-gray-200" : "border-zinc-800";

  return (
    <>
      {/* UrlBuilder section */}
      <UrlBuilder
        protocol={protocol}
        setProtocol={() => {}}
        method={method}
        setMethod={() => {}}
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

      {/* Path Parameters section */}
      <div className={`border-t ${borderColor} mt-0`}>
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
      </div>
    </>
  );
});

UrlPathInputWithParams.displayName = "UrlPathInputWithParams";

export default UrlPathInputWithParams;
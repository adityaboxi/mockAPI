import React, { useState, useCallback } from "react";
import UrlBuilder from "./UrlBuilder";
import PathParamsSection from "./PathParamsSection";

const UrlPathInputWithParams = React.memo(({ protocol, method, onUrlChange, w, inp, mutedTxt, miniBtn, labelTxt }) => {
  const [urlPath, setUrlPath] = useState("");
  const [pathParams, setPathParams] = useState([]);
  const [showPathParamInput, setShowPathParamInput] = useState(false);
  const [newPathKey, setNewPathKey] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [copied, setCopied] = useState(false);

  const extractPathParams = useCallback((path) => {
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = [...path.matchAll(regex)];
    const keys = matches.map(m => m[1]);
    const newParams = keys.map(key => ({ key, value: "" }));
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
    setPathParams(prev => prev.map(p => p.key === key ? { ...p, value } : p));
  }, []);

  const addPathParam = useCallback(() => {
    if (newPathKey.trim()) {
      let currentPath = urlPath;
      if (!currentPath.includes(`:${newPathKey}`)) {
        currentPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + `:${newPathKey}`;
        setUrlPath(currentPath);
        extractPathParams(currentPath);
      }
      setPathParams(prev => [...prev, { key: newPathKey, value: newPathValue }]);
      setNewPathKey('');
      setNewPathValue('');
      setShowPathParamInput(false);
    }
  }, [newPathKey, newPathValue, urlPath, extractPathParams]);

  const buildFinalUrl = useCallback(() => {
    let finalUrl = `${protocol}://api.localhost`;
    let path = urlPath;
    pathParams.forEach(param => {
      path = path.replace(`:${param.key}`, param.value || `{${param.key}}`);
    });
    finalUrl += path;
    return finalUrl;
  }, [protocol, urlPath, pathParams]);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(buildFinalUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildFinalUrl]);

  const finalUrl = buildFinalUrl();

  return (
    <>
      <UrlBuilder
        protocol={protocol}
        setProtocol={() => {}} // not used; protocol/method are from parent
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
      <div className={`grid grid-cols-2 gap-0 border-b ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
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
          labelTxt={labelTxt}
          miniBtn={miniBtn}
          inp={inp}
          mutedTxt={mutedTxt}
          w={w}
        />
        {/* Right side will be filled by QueryParamsSection in MainContent */}
      </div>
    </>
  );
});

export default UrlPathInputWithParams;
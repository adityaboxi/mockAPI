import React, { useState, useCallback } from "react";
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

  const extractPathParams = useCallback((path) => {
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = [...path.matchAll(regex)];
    const keys = matches.map(m => m[1]);
    const newParams = keys.map(key => ({ key, value: "" }));
    setPathParams(newParams);
  }, []);

  const handleUrlPathChange = useCallback((e) => {
    const path = e.target.value;
    setUrlPath(path);
    extractPathParams(path);
  }, [extractPathParams]);

  const updatePathParam = useCallback((key, value) => {
    setPathParams(prev => prev.map(p => p.key === key ? { ...p, value } : p));
  }, []);

  const addPathParamHandler = useCallback(() => {
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
    const activeParams = queryParams.filter(q => q.key && q.value);
    if (activeParams.length > 0) {
      finalUrl += '?' + activeParams.map(q =>
        `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`
      ).join('&');
    }
    return finalUrl;
  }, [protocol, urlPath, pathParams, queryParams]);

  const finalUrl = buildFinalUrl();

  // Theme-aware styles
  const borderColor = w ? "border-gray-200" : "border-zinc-800";
  const cardBg = w ? "bg-white" : "bg-zinc-900";
  const shadow = w ? "shadow-sm" : "shadow-none";

  return (
    <div className={`rounded-xl ${cardBg} ${borderColor} ${shadow} border overflow-hidden`}>
      {/* UrlBuilder section – already styled internally */}
      <UrlBuilder
        protocol={protocol}
        setProtocol={setProtocol}
        method={method}
        setMethod={setMethod}
        urlPath={urlPath}
        setUrlPath={handleUrlPathChange}
        finalUrl={finalUrl}
        copied={false} // pass from parent if needed
        copyToClipboard={() => {}} // pass from parent
        mutedTxt={mutedTxt}
        inp={inp}
        miniBtn={miniBtn}
        w={w}
      />

      {/* Path & Query parameters – now in a clean grid with borders */}
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

export default UrlBuilderContainer;
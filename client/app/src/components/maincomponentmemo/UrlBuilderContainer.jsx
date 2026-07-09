import React, { useState, useCallback } from "react";
import UrlBuilder from "./UrlBuilder";
import PathParamsSection from "./PathParamsSection";

const UrlBuilderContainer = React.memo(({ protocol, setProtocol, method, setMethod, queryParams, updateQueryParam, removeQueryParam, showQueryParamInput, setShowQueryParamInput, newQueryKey, setNewQueryKey, newQueryValue, setNewQueryValue, addQueryParam, labelTxt, miniBtn, inp, mutedTxt, w }) => {
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

  // You’ll need to pass down the finalUrl, copied, copyToClipboard, etc. from parent
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

  return (
    <>
      <UrlBuilder
        protocol={protocol}
        setProtocol={setProtocol}
        method={method}
        setMethod={setMethod}
        urlPath={urlPath}
        setUrlPath={handleUrlPathChange}
        finalUrl={finalUrl}
        copied={false} // pass from parent
        copyToClipboard={() => {}} // pass from parent
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
          addPathParam={addPathParamHandler}
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
    </>
  );
});

export default UrlBuilderContainer;
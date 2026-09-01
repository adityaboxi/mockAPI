// src/components/maincomponentmemo/QueryParamsSection.jsx
import React, { useCallback } from "react";

const QueryParamsSection = React.memo(({
  queryParams,
  updateQueryParam,
  removeQueryParam,
  showQueryParamInput,
  setShowQueryParamInput,
  newQueryKey,
  setNewQueryKey,
  newQueryValue,
  setNewQueryValue,
  addQueryParam,
  labelTxt,
  miniBtn,
  inp,
  mutedTxt,
  w
}) => {
  const isWhiteTheme = w;
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const headerBg = isWhiteTheme ? "bg-gray-50/80" : "bg-zinc-900/60";
  const bodyBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const keyInputBg = isWhiteTheme
    ? "bg-blue-50 border-blue-200 text-blue-600"
    : "bg-blue-950/30 border-blue-800/40 text-blue-400";

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addQueryParam();
    }
  }, [addQueryParam]);

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b select-none ${borderColor} ${headerBg}`}>
        <span className={`text-xs font-semibold tracking-wide uppercase ${labelTxt}`}>
          Query Parameters
        </span>
        <button
          type="button"
          onClick={() => setShowQueryParamInput(!showQueryParamInput)}
          className={`
            px-3 py-1 rounded text-xs font-medium transition-all
            bg-blue-600 hover:bg-blue-500 text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          `}
        >
          {showQueryParamInput ? "Close" : "+ Add"}
        </button>
      </div>

      {/* Body */}
      <div className={`p-3 min-h-[60px] ${bodyBg}`}>
        {queryParams.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {queryParams.map((param, idx) => (
              <div key={param.key || idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={param.key}
                  readOnly
                  className={`
                    w-1/3 rounded px-2.5 py-1 text-xs font-mono border
                    ${keyInputBg}
                    outline-none
                  `}
                />
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updateQueryParam(param.key, e.target.value)}
                  placeholder="value"
                  className={`flex-1 rounded px-2.5 py-1 text-xs outline-none transition-all ${inp}`}
                />
                <button
                  type="button"
                  onClick={() => removeQueryParam(param.key)}
                  className="text-rose-400 hover:text-rose-300 text-xs px-1 shrink-0 transition-colors focus:outline-none"
                  aria-label={`Remove ${param.key} query parameter`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showQueryParamInput && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={newQueryKey}
                onChange={(e) => setNewQueryKey(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="key (e.g. limit)"
                className={`flex-1 rounded px-2.5 py-1 text-xs outline-none transition-all font-mono ${inp}`}
                autoFocus
              />
              <input
                type="text"
                value={newQueryValue}
                onChange={(e) => setNewQueryValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="value (e.g. 10)"
                className={`flex-1 rounded px-2.5 py-1 text-xs outline-none transition-all font-mono ${inp}`}
              />
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={addQueryParam}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowQueryParamInput(false)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${miniBtn}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {queryParams.length === 0 && !showQueryParamInput && (
          <p className={`text-xs py-1 italic select-none ${mutedTxt}`}>Click + Add to insert query parameters</p>
        )}
      </div>
    </div>
  );
});

QueryParamsSection.displayName = "QueryParamsSection";

export default QueryParamsSection;
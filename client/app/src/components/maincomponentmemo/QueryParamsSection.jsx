import React from "react";

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
  // Theme-aware styles
  const isWhiteTheme = w;
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const headerBg = isWhiteTheme ? "bg-gray-50/80" : "bg-zinc-900/60";
  const bodyBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const keyInputBg = isWhiteTheme
    ? "bg-blue-50 border-blue-200 text-blue-600"
    : "bg-blue-950/30 border-blue-800/40 text-blue-400";

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${borderColor} ${headerBg}`}>
        <span className={`text-xs font-semibold tracking-wide uppercase ${labelTxt}`}>
          Query Parameters
        </span>
        <button
          onClick={() => setShowQueryParamInput(!showQueryParamInput)}
          className={`
            px-3 py-1 rounded text-xs font-medium transition-all
            bg-blue-600 hover:bg-blue-500 text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          `}
        >
          + Add
        </button>
      </div>

      {/* Body */}
      <div className={`p-3 min-h-[60px] ${bodyBg}`}>
        {queryParams.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {queryParams.map((param, idx) => (
              <div key={idx} className="flex items-center gap-2">
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
                  onClick={() => removeQueryParam(param.key)}
                  className="text-red-400 hover:text-red-300 text-xs px-1 shrink-0 transition-colors"
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
                placeholder="key"
                className={`flex-1 rounded px-2.5 py-1 text-xs outline-none transition-all ${inp}`}
              />
              <input
                type="text"
                value={newQueryValue}
                onChange={(e) => setNewQueryValue(e.target.value)}
                placeholder="value"
                className={`flex-1 rounded px-2.5 py-1 text-xs outline-none transition-all ${inp}`}
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={addQueryParam}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
              >
                Add
              </button>
              <button
                onClick={() => setShowQueryParamInput(false)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${miniBtn}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {queryParams.length === 0 && !showQueryParamInput && (
          <p className={`text-xs py-1 ${mutedTxt}`}>Click + Add to insert query params</p>
        )}
      </div>
    </div>
  );
});

export default QueryParamsSection;
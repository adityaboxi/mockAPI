import React from "react";

const QueryParamsSection = React.memo(({ queryParams, updateQueryParam, removeQueryParam, showQueryParamInput, setShowQueryParamInput, newQueryKey, setNewQueryKey, newQueryValue, setNewQueryValue, addQueryParam, labelTxt, miniBtn, inp, mutedTxt, w }) => {
  return (
    <div>
      <div className={`flex items-center justify-between px-3 py-2 border-b text-xs ${w ? "border-gray-200 bg-gray-50" : "border-zinc-700/50 bg-[#1a1b1e]"}`}>
        <span className={`font-medium ${labelTxt}`}>Query Parameters</span>
        <button
          onClick={() => setShowQueryParamInput(!showQueryParamInput)}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${miniBtn}`}
        >
          + Add
        </button>
      </div>

      <div className={`p-3 min-h-16 ${w ? "bg-white" : "bg-[#1e1f22]"}`}>
        {queryParams.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-2">
            {queryParams.map((param, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input type="text" value={param.key} readOnly
                  className={`w-1/3 rounded px-2 py-1 text-xs font-mono ${w ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-blue-900/20 text-blue-400 border border-blue-800/40"}`}
                />
                <input type="text" value={param.value} onChange={(e) => updateQueryParam(param.key, e.target.value)} placeholder="value"
                  className={`flex-1 rounded px-2 py-1 text-xs outline-none ${inp}`}
                />
                <button onClick={() => removeQueryParam(param.key)} className="text-red-400 hover:text-red-300 text-xs px-1 shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}

        {showQueryParamInput && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex gap-2">
              <input type="text" value={newQueryKey} onChange={(e) => setNewQueryKey(e.target.value)} placeholder="key"
                className={`flex-1 rounded px-2 py-1 text-xs outline-none ${inp}`} />
              <input type="text" value={newQueryValue} onChange={(e) => setNewQueryValue(e.target.value)} placeholder="value"
                className={`flex-1 rounded px-2 py-1 text-xs outline-none ${inp}`} />
            </div>
            <div className="flex gap-1.5">
              <button onClick={addQueryParam} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">Add</button>
              <button onClick={() => setShowQueryParamInput(false)} className={`px-2 py-1 rounded text-xs ${miniBtn}`}>Cancel</button>
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
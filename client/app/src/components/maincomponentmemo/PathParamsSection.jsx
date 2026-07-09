import React from "react";

const PathParamsSection = React.memo(({ 
  pathParams, 
  updatePathParam, 
  removePathParam,
  showPathParamInput, 
  setShowPathParamInput, 
  newPathKey, 
  setNewPathKey, 
  newPathValue, 
  setNewPathValue, 
  addPathParam, 
  labelTxt, 
  miniBtn, 
  inp, 
  mutedTxt, 
  w 
}) => {
  return (
    <div className={`border-r ${w ? "border-gray-200" : "border-zinc-700/50"}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b text-xs ${w ? "border-gray-200 bg-gray-50" : "border-zinc-700/50 bg-[#1a1b1e]"}`}>
        <span className={`font-medium ${labelTxt}`}>Path Parameters</span>
        <button onClick={() => setShowPathParamInput(!showPathParamInput)} className={`px-2 py-0.5 rounded text-xs transition-colors ${miniBtn}`}>
          + Add
        </button>
      </div>

      <div className={`p-3 min-h-16 ${w ? "bg-white" : "bg-[#1e1f22]"}`}>
        {pathParams.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-2">
            {pathParams.map((param, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-1 rounded shrink-0 ${w ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-blue-900/20 text-blue-400 border border-blue-800/40"}`}>
                  :{param.key}
                </span>
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updatePathParam(param.key, e.target.value)}
                  placeholder="value"
                  className={`flex-1 rounded px-2 py-1 text-xs outline-none ${inp}`}
                />
                <button
                  onClick={() => removePathParam(param.key)}
                  className="text-red-400 hover:text-red-300 text-xs px-1 shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showPathParamInput && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex gap-2">
              <input type="text" value={newPathKey} onChange={(e) => setNewPathKey(e.target.value)} placeholder="param name"
                className={`flex-1 rounded px-2 py-1 text-xs outline-none ${inp}`} />
              <input type="text" value={newPathValue} onChange={(e) => setNewPathValue(e.target.value)} placeholder="default value"
                className={`flex-1 rounded px-2 py-1 text-xs outline-none ${inp}`} />
            </div>
            <div className="flex gap-1.5">
              <button onClick={addPathParam} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">Add</button>
              <button onClick={() => setShowPathParamInput(false)} className={`px-2 py-1 rounded text-xs ${miniBtn}`}>Cancel</button>
            </div>
          </div>
        )}

        {pathParams.length === 0 && !showPathParamInput && (
          <p className={`text-xs py-1 ${mutedTxt}`}>Use :paramName in URL to auto-detect</p>
        )}
      </div>
    </div>
  );
});

export default PathParamsSection;
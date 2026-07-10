/*import React, { useState } from "react";

const GeminiSection = React.memo(({ w }) => {
  const [geminiInput, setGeminiInput] = useState("");

  return (
    <div className={`border-t ${w ? "border-gray-200 bg-white" : "border-zinc-700/50 bg-[#1e1f22]"}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b text-xs ${w ? "border-gray-200 bg-gray-50" : "border-zinc-700/50 bg-[#1a1b1e]"}`}>
        <span className="text-blue-400 font-medium flex items-center gap-1.5">
          <span>✦</span> Ask Gemini
        </span>
        <div className="flex flex-col gap-1">
          <button className={`px-3 py-0.5 rounded text-xs font-medium transition-colors border ${w ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"}`}>Update</button>
          <button className={`px-3 py-0.5 rounded text-xs font-medium transition-colors border ${w ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"}`}>New API</button>
        </div>
      </div>
      <div className="relative">
        <textarea
          value={geminiInput}
          onChange={(e) => setGeminiInput(e.target.value)}
          rows={4}
          className={`w-full px-3 pt-3 pb-8 resize-y outline-none text-sm ${w ? "bg-white text-gray-800 placeholder-gray-400" : "bg-[#1e1f22] text-gray-300 placeholder-zinc-600"}`}
          placeholder="Ask Gemini for API URL and request/response structure..."
          spellCheck="false"
        />
        <button className="absolute bottom-2.5 right-2.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors">Ask AI ✦</button>
      </div>
    </div>
  );
});

export default GeminiSection;*/




import React, { useState } from "react";

const GeminiSection = React.memo(({
  w,
  geminiInput,
  setGeminiInput,
  onAskAI,
  isAiLoading = false,
  onUpdate,
  updateStatus = "idle",
  onNewAPI,
  newApiStatus = "idle",
  renderButtonContent
}) => {
  return (
    <div className={`border-t ${w ? "border-gray-200 bg-white" : "border-zinc-700/50 bg-[#1e1f22]"}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b text-xs ${w ? "border-gray-200 bg-gray-50" : "border-zinc-700/50 bg-[#1a1b1e]"}`}>
        <span className="text-blue-400 font-medium flex items-center gap-1.5">
          <span>✦</span> Ask MockAPI Ai
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onUpdate}
            disabled={updateStatus === "loading"}
            className={`px-3 py-0.5 min-h-5.5 min-w-22.5 rounded text-xs font-medium transition-colors border flex items-center justify-center ${
              w ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
            }`}
          >
            {renderButtonContent(updateStatus, "Update")}
          </button>
          <button
            onClick={onNewAPI}
            disabled={newApiStatus === "loading"}
            className={`px-3 py-0.5 min-h-5.5 min-w-22.5 rounded text-xs font-medium transition-colors border flex items-center justify-center ${
              w ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
            }`}
          >
            {renderButtonContent(newApiStatus, "New API")}
          </button>
        </div>
      </div>

      <div className="relative w-full h-24 shrink-0 overflow-visible">
        <textarea
          value={geminiInput}
          onChange={(e) => setGeminiInput(e.target.value)}
          className={`w-full h-full px-3 pt-3 pb-12 resize-none outline-none text-sm block ${
            w ? "bg-white text-gray-800 placeholder-gray-400 focus:border-gray-300" : "bg-[#1e1f22] text-gray-300 placeholder-zinc-600 focus:border-zinc-700"
          }`}
          placeholder="Ask MockAPI Ai for API URL and request/response structure..."
          spellCheck="false"
          rows={4}
        />
        <button
          type="button"
          onClick={onAskAI}
          disabled={isAiLoading}
          className="absolute bottom-3 right-3 z-30 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold tracking-wide transition-all shadow-md active:scale-95 disabled:opacity-60"
        >
          {isAiLoading ? (
            <div className="flex items-center gap-1">
              <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Thinking...</span>
            </div>
          ) : (
            "Ask AI ✦"
          )}
        </button>
      </div>
    </div>
  );
});

export default GeminiSection;
import React, { useState } from "react";

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

export default GeminiSection;
import React, { useState } from "react";

const GeminiSection = React.memo(({ w }) => {
  const [geminiInput, setGeminiInput] = useState("");
  const isWhiteTheme = w;

  // Theme-aware styles
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const headerBg = isWhiteTheme ? "bg-gray-50/80" : "bg-zinc-900/60";
  const bodyBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const textColor = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const placeholderColor = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${borderColor} ${headerBg}`}>
        <span className="text-blue-400 font-semibold flex items-center gap-2 text-xs tracking-wide uppercase">
          <span className="text-blue-500">✦</span> MockAPI AI
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"}`}>
            Generate with AI
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={`relative ${bodyBg}`}>
        <textarea
          value={geminiInput}
          onChange={(e) => setGeminiInput(e.target.value)}
          rows={4}
          className={`
            w-full px-4 pt-3.5 pb-12 resize-y outline-none text-sm leading-relaxed
            ${textColor} ${placeholderColor}
            ${isWhiteTheme ? "bg-white" : "bg-zinc-900"}
            transition-colors duration-200
            focus:ring-2 focus:ring-blue-500/20 focus:ring-inset
            rounded-b-xl
          `}
          placeholder="Describe the API you want — e.g., 'Create a user profile endpoint with name, email, and role fields'"
          spellCheck="false"
        />

        {/* Action buttons inside the textarea */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className={`text-[10px] ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"} select-none`}>
            {geminiInput.length > 0 ? `${geminiInput.length} chars` : "✨"}
          </span>
          <button
            className={`
              px-4 py-1.5 rounded-lg text-xs font-medium transition-all
              bg-blue-600 hover:bg-blue-500 text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              active:scale-95
              shadow-sm hover:shadow
            `}
          >
            <span className="flex items-center gap-1.5">
              <span>✦</span> Ask AI
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default GeminiSection;
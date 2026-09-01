// src/components/maincomponentmemo/GeminiSection.jsx
import React, { useState, useCallback } from "react";

const GeminiSection = React.memo(({
  w,
  onAskAi,
  isAiLoading = false,
  input: externalInput,
  setInput: externalSetInput,
}) => {
  const [internalInput, setInternalInput] = useState("");
  const isWhiteTheme = w;

  const geminiInput = externalInput !== undefined ? externalInput : internalInput;
  const setGeminiInput = externalSetInput !== undefined ? externalSetInput : setInternalInput;

  const handleSubmit = useCallback(() => {
    if (!geminiInput.trim() || isAiLoading) return;
    onAskAi?.(geminiInput.trim());
  }, [geminiInput, isAiLoading, onAskAi]);

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Theme-aware styles
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const headerBg = isWhiteTheme ? "bg-gray-50/80" : "bg-zinc-900/60";
  const bodyBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const textColor = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const placeholderColor = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b select-none ${borderColor} ${headerBg}`}>
        <span className="text-blue-400 font-semibold flex items-center gap-2 text-xs tracking-wide uppercase">
          <span className="text-blue-500" aria-hidden="true">✦</span> MockAPI AI
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"}`}>
            Generate Schema & Endpoints
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={`relative ${bodyBg}`}>
        <textarea
          value={geminiInput}
          onChange={(e) => setGeminiInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          disabled={isAiLoading}
          className={`
            w-full px-4 pt-3.5 pb-12 resize-y outline-none text-sm leading-relaxed
            ${textColor} ${placeholderColor}
            ${isWhiteTheme ? "bg-white" : "bg-zinc-900"}
            transition-colors duration-200
            focus:ring-2 focus:ring-blue-500/20 focus:ring-inset
            rounded-b-xl disabled:opacity-60
          `}
          placeholder="Describe the API endpoint you want to mock — e.g., 'Create a user profile endpoint with UUID, fullName, email, and roles'"
          spellCheck="false"
        />

        {/* Action controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className={`text-[10px] ${isWhiteTheme ? "text-gray-400" : "text-zinc-500"} select-none hidden sm:inline`}>
            {geminiInput.length > 0 ? `${geminiInput.length} chars (Cmd+↵)` : "✨"}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isAiLoading || !geminiInput.trim()}
            className={`
              px-4 py-1.5 rounded-lg text-xs font-medium transition-all
              bg-blue-600 hover:bg-blue-500 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
              active:scale-95 shadow-sm
            `}
          >
            {isAiLoading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Thinking...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>✦</span> Ask AI
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

GeminiSection.displayName = "GeminiSection";

export default GeminiSection;
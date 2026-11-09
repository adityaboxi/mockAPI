// src/components/maincomponentmemo/GeminiSection.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";

// Static theme mappings hoisted outside component scope
const THEME_STYLES = {
  white: {
    border: "border-gray-200",
    headerBg: "bg-gray-50/80",
    bodyBg: "bg-white",
    textColor: "text-gray-800",
    placeholder: "placeholder-gray-400",
    subText: "text-gray-400",
    focusOffset: "focus:ring-offset-white",
  },
  dark: {
    border: "border-zinc-800",
    headerBg: "bg-zinc-900/60",
    bodyBg: "bg-zinc-900",
    textColor: "text-zinc-200",
    placeholder: "placeholder-zinc-500",
    subText: "text-zinc-500",
    focusOffset: "focus:ring-offset-zinc-900",
  },
};

const GeminiSection = React.memo(({
  w = false,
  onAskAi,
  isAiLoading = false,
  input: externalInput,
  setInput: externalSetInput,
}) => {
  const [internalInput, setInternalInput] = useState("");
  const styles = w ? THEME_STYLES.white : THEME_STYLES.dark;

  const geminiInput = externalInput !== undefined ? externalInput : internalInput;
  const setGeminiInput = externalSetInput !== undefined ? externalSetInput : setInternalInput;

  // Keep a ref to current input to prevent callback re-creation on every keystroke
  const inputRef = useRef(geminiInput);
  useEffect(() => {
    inputRef.current = geminiInput;
  }, [geminiInput]);

  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const currentVal = inputRef.current ? inputRef.current.trim() : "";
      if (!currentVal || isAiLoading) return;
      onAskAi?.(currentVal);
    },
    [isAiLoading, onAskAi]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className={`rounded-xl border ${styles.border} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b select-none ${styles.border} ${styles.headerBg}`}>
        <span className="text-blue-400 font-semibold flex items-center gap-2 text-xs tracking-wide uppercase">
          <span className="text-blue-500" aria-hidden="true">✦</span> MockAPI AI
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${styles.subText}`}>
            Generate Schema & Endpoints
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={`relative ${styles.bodyBg}`}>
        <textarea
          value={geminiInput}
          onChange={(e) => setGeminiInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          disabled={isAiLoading}
          className={`
            w-full px-4 pt-3.5 pb-12 resize-y outline-none text-sm leading-relaxed
            ${styles.textColor} ${styles.placeholder} ${styles.bodyBg}
            transition-colors duration-200
            focus:ring-2 focus:ring-blue-500/20 focus:ring-inset
            rounded-b-xl disabled:opacity-60
          `}
          placeholder="Describe the API endpoint you want to mock — e.g., 'Create a user profile endpoint with UUID, fullName, email, and roles'"
          spellCheck="false"
        />

        {/* Action controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className={`text-[10px] ${styles.subText} select-none hidden sm:inline`}>
            {geminiInput.length > 0 ? `${geminiInput.length} chars (Cmd+↵)` : "✨"}
          </span>
          <button
            type="submit"
            disabled={isAiLoading || !geminiInput.trim()}
            className={`
              px-4 py-1.5 rounded-lg text-xs font-medium transition-all
              bg-blue-600 hover:bg-blue-500 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${styles.focusOffset}
              active:scale-95 shadow-sm
            `}
          >
            {isAiLoading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
    </form>
  );
});

GeminiSection.displayName = "GeminiSection";

export default GeminiSection;
// src/components/maincomponentmemo/UrlPathInput.jsx
import React, { useCallback } from "react";

const UrlPathInput = React.memo(({ urlPath, onUrlPathChange, inp }) => {
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  }, []);

  return (
    <textarea
      value={urlPath}
      onChange={onUrlPathChange}
      onKeyDown={handleKeyDown}
      placeholder="users/:userId/posts"
      rows={1}
      spellCheck="false"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      className={`
        flex-1 rounded-lg px-3.5 py-2 text-sm font-mono outline-none
        transition-all duration-200
        ${inp}
        focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
        resize-none overflow-hidden
        min-h-[38px]
        leading-relaxed
      `}
      style={{
        minHeight: '38px',
        height: 'auto',
      }}
      aria-label="API endpoint URL path"
    />
  );
});

UrlPathInput.displayName = "UrlPathInput";

export default UrlPathInput;
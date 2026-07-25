import React from "react";

const UrlPathInput = React.memo(({ urlPath, onUrlPathChange, inp }) => {
  return (
    <textarea
      value={urlPath}
      onChange={onUrlPathChange}
      placeholder="users/:userId/posts"
      rows={1}
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
        height: 'auto'
      }}
    />
  );
});

export default UrlPathInput;
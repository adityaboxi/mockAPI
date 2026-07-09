import React from "react";

const UrlPathInput = React.memo(({ urlPath, onUrlPathChange, inp }) => {
  return (
    <textarea
      value={urlPath}
      onChange={onUrlPathChange}
      placeholder="users/:userId/posts"
      rows={1}
      className={`flex-1 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors resize-none overflow-hidden ${inp}`}
      style={{
        minHeight: '36px',
        height: 'auto'
      }}
    />
  );
});

export default UrlPathInput;
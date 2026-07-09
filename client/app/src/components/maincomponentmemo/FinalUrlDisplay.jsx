import React from "react";

const FinalUrlDisplay = ({ finalUrl, protocol, copied, copyToClipboard, miniBtn, w }) => {
  
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono max-w-64 ${w ? "bg-gray-100 text-gray-600" : "bg-[#161718] text-blue-400"}`}>
      <span className="truncate">
        {finalUrl}
      </span>
      <button
        onClick={copyToClipboard}
        className={`shrink-0 px-1.5 py-0.5 rounded text-xs transition-colors ${copied ? "bg-green-600 text-white" : miniBtn}`}
      >
        {copied ? "✓" : "⎘"}
      </button>
    </div>
  );
};

export default FinalUrlDisplay;
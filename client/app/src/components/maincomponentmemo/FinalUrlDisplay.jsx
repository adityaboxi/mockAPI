// src/components/maincomponentmemo/FinalUrlDisplay.jsx
import React from "react";

const FinalUrlDisplay = ({ finalUrl, protocol, copied, copyToClipboard, onOpenCodeExport, miniBtn, w }) => {
  const isWhiteTheme = w;
  const isPlaceholder = !finalUrl || finalUrl.includes("No endpoint") || finalUrl.includes("No API");

  // Theme-aware styles
  const displayBg = isWhiteTheme
    ? "bg-gray-50 border border-gray-200 text-gray-700"
    : "bg-zinc-900/80 border border-zinc-800 text-blue-400";
  const displayHover = isWhiteTheme
    ? "hover:border-blue-300"
    : "hover:border-blue-500/30";

  const copyBtnBase =
    "shrink-0 px-2 py-1 rounded text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed";

  const copyBtnDefault = isWhiteTheme
    ? "bg-blue-600 hover:bg-blue-500 text-white focus:ring-offset-white"
    : "bg-blue-600 hover:bg-blue-500 text-white focus:ring-offset-zinc-900";

  const copyBtnSuccess =
    "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500";

  const exportBtnClass = isWhiteTheme
    ? "bg-gray-200 hover:bg-gray-300 text-gray-700 hover:text-gray-900"
    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white";

  return (
    <div
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
        max-w-xs min-w-[140px] transition-all duration-200
        ${displayBg} ${displayHover}
      `}
    >
      <span className="truncate flex-1 font-mono text-[11px]" title={finalUrl}>
        {finalUrl}
      </span>

      {onOpenCodeExport && (
        <button
          type="button"
          onClick={onOpenCodeExport}
          disabled={isPlaceholder}
          className={`${copyBtnBase} ${exportBtnClass} active:scale-95`}
          title="Export Code Snippet (cURL, fetch, Python, Go)"
          aria-label="Export Code Snippet"
        >
          <span>&lt;/&gt;</span>
        </button>
      )}

      <button
        type="button"
        onClick={copyToClipboard}
        disabled={isPlaceholder}
        className={`
          ${copyBtnBase}
          ${copied ? copyBtnSuccess : copyBtnDefault}
          active:scale-95
        `}
        aria-label={copied ? "Copied URL to clipboard" : "Copy URL to clipboard"}
        title={copied ? "Copied!" : "Copy URL"}
      >
        {copied ? (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
};

export default React.memo(FinalUrlDisplay);
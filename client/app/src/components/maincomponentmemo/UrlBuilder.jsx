// src/components/maincomponentmemo/UrlBuilder.jsx
import React from "react";
import ProtocolSelect from "./ProtocolSelect";
import MethodSelect from "./MethodSelect";
import UrlPathInput from "./UrlPathInput";
import FinalUrlDisplay from "./FinalUrlDisplay";

const UrlBuilder = ({
  protocol,
  setProtocol,
  method,
  setMethod,
  urlPath,
  setUrlPath,
  finalUrl,
  actualFullUrl,
  copied,
  copyToClipboard,
  onOpenCodeExport,
  mutedTxt,
  inp,
  miniBtn,
  w
}) => {
  const displayUrl =
    actualFullUrl && actualFullUrl.trim() !== ""
      ? actualFullUrl
      : finalUrl && finalUrl.trim() !== ""
      ? finalUrl
      : "— No endpoint compiled —";

  // Theme-aware styles
  const borderColor = w ? "border-gray-200" : "border-zinc-800";
  const bg = w ? "bg-white" : "bg-zinc-900";

  return (
    <div className={`px-4 py-3 ${borderColor} ${bg} border-b`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Protocol & Method */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ProtocolSelect protocol={protocol} setProtocol={setProtocol} w={w} />
          <MethodSelect method={method} setMethod={setMethod} w={w} />
        </div>

        {/* Separator */}
        <span className={`text-sm font-mono select-none ${mutedTxt}`}>/</span>

        {/* URL Path Input */}
        <div className="flex-1 min-w-[140px]">
          <UrlPathInput urlPath={urlPath} onUrlPathChange={setUrlPath} inp={inp} />
        </div>

        {/* Final URL Display & Action Bar */}
        <FinalUrlDisplay
          finalUrl={displayUrl}
          protocol={protocol}
          copied={copied}
          copyToClipboard={copyToClipboard}
          onOpenCodeExport={onOpenCodeExport}
          miniBtn={miniBtn}
          w={w}
        />
      </div>
    </div>
  );
};

export default React.memo(UrlBuilder);
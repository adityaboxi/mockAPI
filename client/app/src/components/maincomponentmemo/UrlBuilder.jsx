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
  actualFullUrl,
  copied,
  copyToClipboard,
  mutedTxt,
  inp,
  miniBtn,
  w
}) => {
  const displayUrl = actualFullUrl && actualFullUrl.trim() !== "" 
    ? actualFullUrl 
    : "— No API selected —";

  // Theme-aware styles
  const borderColor = w ? "border-gray-200" : "border-zinc-800";
  const bg = w ? "bg-white" : "bg-zinc-900";

  return (
    <div className={`px-4 py-3 ${borderColor} ${bg} border-b`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Protocol & Method - compact */}
        <div className="flex items-center gap-1.5">
          <ProtocolSelect protocol={protocol} setProtocol={setProtocol} w={w} />
          <MethodSelect method={method} setMethod={setMethod} w={w} />
        </div>

        {/* Separator */}
        <span className={`text-sm font-mono ${mutedTxt}`}>/</span>

        {/* URL Path Input - flexible */}
        <div className="flex-1 min-w-[140px]">
          <UrlPathInput urlPath={urlPath} onUrlPathChange={setUrlPath} inp={inp} />
        </div>

        {/* Final URL Display */}
        <FinalUrlDisplay
          finalUrl={displayUrl}
          protocol={protocol}
          copied={copied}
          copyToClipboard={copyToClipboard}
          miniBtn={miniBtn}
          w={w}
        />
      </div>
    </div>
  );
};

export default UrlBuilder;
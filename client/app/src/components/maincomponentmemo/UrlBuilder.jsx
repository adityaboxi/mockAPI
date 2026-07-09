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
  actualFullUrl,        // the full URL from loaded version or API response
  copied,
  copyToClipboard,
  mutedTxt,
  inp,
  miniBtn,
  w
}) => {
  // Show actualFullUrl if available, otherwise a placeholder
  const displayUrl = actualFullUrl && actualFullUrl.trim() !== "" 
    ? actualFullUrl 
    : "— No API selected —";

  return (
    <div className={`px-4 py-3 border-b ${w ? "border-gray-200 bg-white" : "border-zinc-700/50 bg-[#1e1f22]"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <ProtocolSelect protocol={protocol} setProtocol={setProtocol} w={w} />
        <MethodSelect method={method} setMethod={setMethod} w={w} />
        <span className={`text-sm ${mutedTxt}`}>/</span>
        <UrlPathInput urlPath={urlPath} onUrlPathChange={setUrlPath} inp={inp} />

        <FinalUrlDisplay
  finalUrl={displayUrl}
  protocol={protocol}
  copied={copied}
  copyToClipboard={copyToClipboard}   // uses the parent function
  miniBtn={miniBtn}
  w={w}
/>
      </div>
    </div>
  );
};

export default UrlBuilder;
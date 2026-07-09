import React from "react";

const Authtokenetc = ({
  isAuthEnabled = false, 
  setIsAuthEnabled,
  latency = 0, 
  setLatency,
  rateLimit = 0, 
  setRateLimit,
  authScheme = "BearerAuth",
  setAuthScheme,
  w = false,
  mutedTxt = "text-zinc-500", 
  inp = "bg-zinc-800 text-zinc-200 border-zinc-700",
  labelTxt = "text-zinc-400"
}) => {
  
  const handleNumericChange = (value, setter) => {
    const parsed = parseInt(value, 10);
    setter(isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <button
        type="button"
        onClick={() => setIsAuthEnabled?.(!isAuthEnabled)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
          isAuthEnabled
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : w 
              ? "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
              : "bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:bg-zinc-700/50"
        }`}
      >
        {isAuthEnabled ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
        <span>{isAuthEnabled ? "Auth Required" : "Public Access"}</span>
      </button>

      {isAuthEnabled && (
        <div className="flex items-center gap-2 animate-fadeIn">
          <span className={`text-xs font-medium ${labelTxt}`}>Strategy:</span>
          <select
            value={authScheme}
            onChange={(e) => setAuthScheme?.(e.target.value)}
            className={`text-xs px-2 py-0.5 rounded border font-medium outline-none transition-colors ${inp}`}
          >
            <option value="BearerAuth">Bearer JWT (Authorization Header)</option>
            <option value="ApiKeyAuth">X-API-Key (Custom Header)</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 relative">
        <svg className={`w-3.5 h-3.5 ${latency > 0 ? "text-amber-400" : mutedTxt}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className={`text-xs font-medium ${w ? "text-gray-600" : "text-zinc-400"}`}>Latency:</span>
        <input
          type="number"
          value={latency || ""}
          onChange={(e) => handleNumericChange(e.target.value, setLatency)}
          placeholder="0"
          className={`w-16 px-1.5 py-0.5 pr-6 text-xs rounded text-right font-mono focus:outline-none focus:ring-1 ${inp}`}
        />
        <span className="absolute right-1.5 bottom-1 text-[10px] text-zinc-500 uppercase pointer-events-none">ms</span>
      </div>

      <div className="flex items-center gap-2 relative">
        <svg className={`w-3.5 h-3.5 ${rateLimit > 0 ? "text-rose-400" : mutedTxt}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span className={`text-xs font-medium ${w ? "text-gray-600" : "text-zinc-400"}`}>Rate Limit:</span>
        <input
          type="number"
          value={rateLimit || ""}
          onChange={(e) => handleNumericChange(e.target.value, setRateLimit)}
          placeholder="∞"
          className={`w-20 px-1.5 py-0.5 pr-9 text-xs rounded text-right font-mono focus:outline-none focus:ring-1 ${inp}`}
        />
        <span className="absolute right-1.5 bottom-1 text-[10px] text-zinc-500 pointer-events-none">req/m</span>
      </div>
    </div>
  );
};

export default Authtokenetc;
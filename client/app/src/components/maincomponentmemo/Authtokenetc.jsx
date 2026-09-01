// src/components/maincomponentmemo/Authtokenetc.jsx
import React, { useCallback } from "react";

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
  labelTxt = "text-zinc-400"
}) => {
  const handleNumericChange = useCallback((value, setter, max = Infinity) => {
    if (value === "") {
      setter?.(0);
      return;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      setter?.(0);
    } else {
      setter?.(Math.min(parsed, max));
    }
  }, []);

  const isWhiteTheme = w;
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const bgInput = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const textInput = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const placeholderInput = isWhiteTheme ? "placeholder-gray-400" : "placeholder-zinc-500";
  const focusRing = "focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

  return (
    <div className={`flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-lg border ${borderColor} ${isWhiteTheme ? "bg-gray-50/80" : "bg-zinc-900/60"}`}>
      {/* Auth toggle button */}
      <button
        type="button"
        onClick={() => setIsAuthEnabled?.(!isAuthEnabled)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
          transition-all duration-200
          ${isAuthEnabled
            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
            : isWhiteTheme
              ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          active:scale-95
        `}
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

      {/* Auth scheme selector */}
      {isAuthEnabled && (
        <div className="flex items-center gap-2 animate-fadeIn">
          <span className={`text-xs font-medium ${labelTxt}`}>Strategy:</span>
          <select
            value={authScheme}
            onChange={(e) => setAuthScheme?.(e.target.value)}
            aria-label="Authentication Strategy"
            className={`
              text-xs px-2.5 py-1 rounded border outline-none
              font-medium transition-all duration-200
              ${bgInput} ${borderColor} ${textInput}
              ${focusRing}
              cursor-pointer
            `}
          >
            <option value="BearerAuth" className={isWhiteTheme ? "bg-white text-gray-800" : "bg-zinc-900 text-zinc-100"}>
              Bearer JWT
            </option>
            <option value="ApiKeyAuth" className={isWhiteTheme ? "bg-white text-gray-800" : "bg-zinc-900 text-zinc-100"}>
              X-API-Key
            </option>
          </select>
        </div>
      )}

      {/* Latency input */}
      <div className="flex items-center gap-2 relative">
        <svg className={`w-3.5 h-3.5 ${latency > 0 ? "text-amber-400" : mutedTxt}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className={`text-xs font-medium ${isWhiteTheme ? "text-gray-600" : "text-zinc-400"}`}>Latency</span>
        <input
          type="number"
          min="0"
          max="10000"
          value={latency || ""}
          onChange={(e) => handleNumericChange(e.target.value, setLatency, 10000)}
          placeholder="0"
          aria-label="Simulation Latency (ms)"
          className={`
            w-16 px-2 py-1 pr-7 text-xs rounded border text-right font-mono outline-none
            transition-all duration-200
            ${bgInput} ${borderColor} ${textInput} ${placeholderInput}
            ${focusRing}
          `}
        />
        <span className="absolute right-2 bottom-1.5 text-[10px] font-medium text-zinc-500 pointer-events-none select-none">ms</span>
      </div>

      {/* Rate limit input */}
      <div className="flex items-center gap-2 relative">
        <svg className={`w-3.5 h-3.5 ${rateLimit > 0 ? "text-rose-400" : mutedTxt}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span className={`text-xs font-medium ${isWhiteTheme ? "text-gray-600" : "text-zinc-400"}`}>Rate</span>
        <input
          type="number"
          min="0"
          value={rateLimit || ""}
          onChange={(e) => handleNumericChange(e.target.value, setRateLimit)}
          placeholder="∞"
          aria-label="Rate Limit per minute"
          className={`
            w-20 px-2 py-1 pr-9 text-xs rounded border text-right font-mono outline-none
            transition-all duration-200
            ${bgInput} ${borderColor} ${textInput} ${placeholderInput}
            ${focusRing}
          `}
        />
        <span className="absolute right-2 bottom-1.5 text-[10px] font-medium text-zinc-500 pointer-events-none select-none">req/m</span>
      </div>
    </div>
  );
};

Authtokenetc.displayName = "Authtokenetc";

export default React.memo(Authtokenetc);
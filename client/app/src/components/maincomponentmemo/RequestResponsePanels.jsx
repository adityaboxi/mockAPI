import React, { useState, useEffect, useRef } from "react";

const RequestResponsePanels = React.memo(({
  requestBody, setRequestBody,
  responseBody, setResponseBody,
  panel, panelHdr, w
}) => {
  const [requestError, setRequestError] = useState('');
  const [responseError, setResponseError] = useState('');

  const requestGutterRef = useRef(null);
  const requestTextareaRef = useRef(null);
  const responseGutterRef = useRef(null);
  const responseTextareaRef = useRef(null);

  // ─── Default JSON values ─────────────────────────────────────────
  useEffect(() => {
    const defaultJson = `{
  "name": "Alex Dev",
  "role": "Admin"
}`;
    
    if (!requestBody || !requestBody.trim()) {
      setRequestBody(defaultJson);
    }
    if (!responseBody || !responseBody.trim()) {
      setResponseBody(defaultJson);
    }

    const timer = setTimeout(() => {
      if (requestTextareaRef.current) {
        requestTextareaRef.current.focus();
        requestTextareaRef.current.setSelectionRange(4, 4);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // ─── JSON validation ─────────────────────────────────────────────
  useEffect(() => {
    if (!requestBody || !requestBody.trim() || requestBody === "{\n  \n}") { setRequestError(''); return; }
    try { JSON.parse(requestBody); setRequestError(''); }
    catch (err) { setRequestError(err.message); }
  }, [requestBody]);

  useEffect(() => {
    if (!responseBody || !responseBody.trim() || responseBody === "{\n  \n}") { setResponseError(''); return; }
    try { JSON.parse(responseBody); setResponseError(''); }
    catch (err) { setResponseError(err.message); }
  }, [responseBody]);

  // ─── Format JSON helper ─────────────────────────────────────────
  const formatJSON = (value, setter, setError) => {
    if (!value || !value.trim()) { setter(''); setError(''); return; }
    try {
      const parsed = JSON.parse(value);
      setter(JSON.stringify(parsed, null, 2));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  // ─── Scroll sync ─────────────────────────────────────────────────
  const handleScroll = (textareaRef, gutterRef) => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // ─── Theme-aware styles ──────────────────────────────────────────
  const isWhiteTheme = w;
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const textareaBg = isWhiteTheme ? "bg-white" : "bg-zinc-900/50";
  const textareaText = isWhiteTheme ? "text-gray-800" : "text-zinc-200";
  const gutterBg = isWhiteTheme ? "bg-gray-50/80 border-gray-200" : "bg-zinc-900/60 border-zinc-800";
  const gutterText = isWhiteTheme ? "text-gray-300" : "text-zinc-600";
  const footerBg = isWhiteTheme ? "bg-gray-50/80 border-gray-200" : "bg-zinc-900/40 border-zinc-800";
  const errorText = "text-rose-400 font-medium text-[11px]";

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-0 w-full h-[380px] min-h-[380px] shrink-0 rounded-lg border ${borderColor} overflow-hidden`}>
      {[
        { 
          label: '📤 Request Input',
          value: requestBody,
          setter: setRequestBody,
          error: requestError,
          setError: setRequestError,
          textareaRef: requestTextareaRef,
          gutterRef: requestGutterRef
        },
        { 
          label: '📥 Response Blueprint',
          value: responseBody,
          setter: setResponseBody,
          error: responseError,
          setError: setResponseError,
          textareaRef: responseTextareaRef,
          gutterRef: responseGutterRef
        },
      ].map(({ label, value, setter, error, setError, textareaRef, gutterRef }, idx) => {
        const lines = value ? value.split('\n') : [''];

        return (
          <div 
            key={idx} 
            className={`
              flex flex-col h-full min-w-0
              ${idx === 0 ? 'border-r-0 md:border-r' : ''}
              ${borderColor}
              ${isWhiteTheme ? 'bg-white' : 'bg-zinc-900'}
            `}
          >
            {/* Header */}
            <div className={`px-3.5 py-2.5 text-xs font-semibold tracking-wide shrink-0 select-none border-b ${borderColor} ${isWhiteTheme ? 'bg-gray-50/80 text-gray-600' : 'bg-zinc-900/80 text-zinc-300'}`}>
              {label}
            </div>

            {/* Editor area */}
            <div className="flex flex-1 min-h-0 font-mono text-xs overflow-hidden relative">
              {/* Line numbers gutter */}
              <div 
                ref={gutterRef}
                className={`
                  w-9 text-right pr-2.5 pt-2 pb-4 select-none font-mono text-[11px] leading-5 shrink-0 overflow-hidden border-r
                  ${gutterBg} ${gutterText}
                `}
              >
                {lines.map((_, i) => (
                  <div key={i} className="h-5">{i + 1}</div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={value || ''}
                onChange={(e) => setter(e.target.value)}
                onScroll={() => handleScroll(textareaRef, gutterRef)}
                className={`
                  flex-1 pt-2 pl-3 pr-3 pb-4 outline-none resize-none font-mono text-[12px] leading-5 overflow-auto
                  ${textareaBg} ${textareaText}
                  [&::-webkit-scrollbar]:w-1.5
                  [&::-webkit-scrollbar-track]:bg-transparent
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  ${isWhiteTheme
                    ? "[&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400"
                    : "[&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
                  }
                `}
                spellCheck="false"
                wrap="off"
              />
            </div>

            {/* Footer */}
            <div className={`px-3.5 py-1.5 flex items-center border-t shrink-0 h-9 ${footerBg} ${borderColor}`}>
              <div className="flex-1 min-w-0 truncate pr-2">
                {error && (
                  <span className={`${errorText} block truncate flex items-center gap-1.5`}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
                    {error}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => formatJSON(value, setter, setError)}
                className={`
                  px-3 py-1 rounded text-xs font-medium transition-all
                  bg-blue-600 hover:bg-blue-500 text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                  ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
                `}
              >
                Format JSON
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default RequestResponsePanels;
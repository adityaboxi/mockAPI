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

  const handleScroll = (textareaRef, gutterRef) => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="grid grid-cols-2 gap-0 w-full h-[380px] min-h-[380px] shrink-0 border-t border-x border-transparent">
      {[
        { 
          label: '📤 Request Input', value: requestBody, setter: setRequestBody, 
          error: requestError, setError: setRequestError, 
          textareaRef: requestTextareaRef, gutterRef: requestGutterRef 
        },
        { 
          label: '📥 Response Blueprint', value: responseBody, setter: setResponseBody, 
          error: responseError, setError: setResponseError, 
          textareaRef: responseTextareaRef, gutterRef: responseGutterRef 
        },
      ].map(({ label, value, setter, error, setError, textareaRef, gutterRef }, idx) => {
        const lines = value ? value.split('\n') : [''];

        return (
          <div 
            key={idx} 
            className={`flex flex-col h-full min-w-0 ${panel} ${
              idx === 0 
                ? 'border-r-0 rounded-l rounded-r-none border-b-0' 
                : 'rounded-r rounded-l-none border-b-0'
            }`}
          >
            <div className={`px-3 py-2 text-xs font-semibold tracking-wide shrink-0 select-none ${panelHdr}`}>
              {label}
            </div>

            <div className="flex flex-1 min-h-0 font-mono text-xs overflow-hidden relative">
              <div 
                ref={gutterRef}
                className={`w-9 text-right pr-2 pt-2 pb-4 select-none font-mono text-[11px] leading-5 shrink-0 border-r overflow-hidden ${
                  w ? "text-gray-300 bg-gray-50/50 border-gray-100" : "text-zinc-600 bg-[#161718]/40 border-zinc-700/30"
                }`}
              >
                {lines.map((_, i) => (
                  <div key={i} className="h-5">{i + 1}</div>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={value || ''}
                onChange={(e) => setter(e.target.value)}
                onScroll={() => handleScroll(textareaRef, gutterRef)}
                className={`flex-1 pt-2 pl-2 pr-2 pb-4 outline-none resize-none font-mono text-[12px] leading-5 overflow-auto custom-scrollbar ${
                  w ? "bg-white text-gray-800" : "bg-transparent text-gray-300"
                }`}
                spellCheck="false"
                wrap="off"
              />
            </div>

            <div className={`px-3 py-1.5 flex items-center border-t shrink-0 h-9 ${
              w ? "bg-gray-50 border-gray-200" : "bg-[#1a1b1e] border-zinc-700/50"
            }`}>
              <div className="flex-1 min-w-0 truncate pr-2">
                {error && (
                  <span className="text-rose-400 font-medium text-[11px] block truncate">
                    ⚠️ {error}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => formatJSON(value, setter, setError)}
                className="text-blue-400 hover:text-blue-300 text-xs font-medium tracking-wide shrink-0 transition-colors select-none focus:outline-none"
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
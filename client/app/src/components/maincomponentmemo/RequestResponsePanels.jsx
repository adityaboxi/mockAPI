// src/components/maincomponentmemo/RequestResponsePanels.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

const TEMPLATES = [
  {
    name: "⚡ Dynamic Faker Object",
    json: {
      id: "{{faker.string.uuid}}",
      name: "{{faker.person.fullName}}",
      email: "{{faker.internet.email}}",
      avatar: "{{faker.image.avatar}}",
      city: "{{faker.location.city}}",
      price: "{{faker.commerce.price}}",
      role: "{{faker.helpers.arrayElement([\"admin\", \"developer\", \"reviewer\"])}}",
      isActive: "{{faker.datatype.boolean}}"
    }
  },
  {
    name: "⚡ Dynamic Faker List",
    json: [
      {
        id: "{{faker.string.uuid}}",
        name: "{{faker.person.fullName}}",
        email: "{{faker.internet.email}}",
        avatar: "{{faker.image.avatar}}"
      },
      {
        id: "{{faker.string.uuid}}",
        name: "{{faker.person.fullName}}",
        email: "{{faker.internet.email}}",
        avatar: "{{faker.image.avatar}}"
      }
    ]
  },
  {
    name: "User Object",
    json: {
      id: "usr_101",
      name: "Alex Dev",
      email: "alex.dev@example.com",
      role: "Admin",
      isActive: true,
      createdAt: new Date().toISOString()
    }
  },
  {
    name: "Paginated List",
    json: {
      page: 1,
      limit: 10,
      total: 42,
      data: [
        { id: 1, title: "Item Alpha", status: "active" },
        { id: 2, title: "Item Beta", status: "pending" }
      ]
    }
  },
  {
    name: "Auth Token",
    json: {
      tokenType: "Bearer",
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      expiresIn: 3600,
      refreshToken: "d9a8f2c1b4e6..."
    }
  },
  {
    name: "Error Response",
    json: {
      error: "ResourceNotFound",
      message: "The requested entity was not found",
      statusCode: 404,
      timestamp: new Date().toISOString()
    }
  },
  {
    name: "Empty Object",
    json: {}
  },
  {
    name: "Empty Array",
    json: []
  }
];

const JsonEditorPanel = ({
  label,
  value,
  setter,
  error,
  setError,
  isWhiteTheme,
  borderColor,
  isRightPanel
}) => {
  const [copied, setCopied] = useState(false);
  const [activeLine, setActiveLine] = useState(1);
  const [activeCol, setActiveCol] = useState(1);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const dropdownRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Close template menu on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsTemplateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Compute stats
  const { lineCount, byteSize, keyCount } = useMemo(() => {
    if (!value) return { lineCount: 1, byteSize: "0 B", keyCount: 0 };
    const lines = value.split("\n").length;
    const bytes = new Blob([value]).size;
    const formattedBytes =
      bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    let keys = 0;
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null) {
        keys = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      }
    } catch (_) {}
    return { lineCount: lines, byteSize: formattedBytes, keyCount: keys };
  }, [value]);

  // Sync scroll between textarea and line-number gutter
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Track active line and column
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart || 0;
    const textBefore = (value || "").substring(0, pos);
    const lines = textBefore.split("\n");
    setActiveLine(lines.length);
    setActiveCol(lines[lines.length - 1].length + 1);
  };

  // Handle Tab key indentation
  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const currentValue = value || "";
      const newValue = currentValue.substring(0, start) + "  " + currentValue.substring(end);
      setter(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          updateCursorPosition();
        }
      }, 0);
    }
  };

  // Format JSON
  const formatJSON = useCallback(() => {
    if (!value || !value.trim()) {
      setter("");
      setError("");
      return;
    }
    try {
      const parsed = JSON.parse(value);
      setter(JSON.stringify(parsed, null, 2));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [value, setter, setError]);

  // Minify JSON
  const minifyJSON = useCallback(() => {
    if (!value || !value.trim()) {
      setter("");
      setError("");
      return;
    }
    try {
      const parsed = JSON.parse(value);
      setter(JSON.stringify(parsed));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [value, setter, setError]);

  // Copy JSON
  const copyJSON = useCallback(() => {
    if (!value) return;

    const triggerSuccess = () => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(triggerSuccess).catch(() => {});
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        triggerSuccess();
      } catch (_) {
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, [value]);

  // Apply template
  const applyTemplate = (tpl) => {
    setter(JSON.stringify(tpl.json, null, 2));
    setError("");
    setIsTemplateMenuOpen(false);
  };

  const lines = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);
  const isValid = !error && value && value.trim();

  return (
    <div
      className={`
        flex flex-col h-full min-w-0 transition-colors
        ${!isRightPanel ? "border-r-0 md:border-r" : ""}
        ${borderColor}
        ${isWhiteTheme ? "bg-white text-gray-800" : "bg-[#111216] text-zinc-200"}
      `}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <div
        className={`
          px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold shrink-0 select-none border-b
          ${borderColor}
          ${isWhiteTheme ? "bg-gray-50/90 text-gray-700" : "bg-[#18191f] text-zinc-300"}
        `}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide flex items-center gap-1.5">
            {label}
          </span>
          <span
            className={`
              text-[10px] px-1.5 py-0.5 rounded font-mono font-normal
              ${isWhiteTheme ? "bg-gray-200/70 text-gray-600" : "bg-zinc-800 text-zinc-400"}
            `}
          >
            {byteSize}
          </span>
          {keyCount > 0 && (
            <span
              className={`
                text-[10px] px-1.5 py-0.5 rounded font-mono font-normal
                ${isWhiteTheme ? "bg-gray-200/70 text-gray-600" : "bg-zinc-800 text-zinc-400"}
              `}
            >
              {keyCount} {keyCount === 1 ? "item" : "items"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Validity status badge */}
          {isValid ? (
            <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Valid JSON
            </span>
          ) : error ? (
            <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1 font-mono bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Invalid
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 font-mono">Empty</span>
          )}

          {/* Quick template selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsTemplateMenuOpen((prev) => !prev)}
              className={`
                px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all
                ${isWhiteTheme ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}
              `}
              title="Insert JSON template"
            >
              <span>Presets</span>
              <span className="text-[9px] opacity-70">▼</span>
            </button>

            {isTemplateMenuOpen && (
              <div
                className={`
                  absolute right-0 mt-1.5 w-48 rounded-lg shadow-xl border z-50 py-1 font-sans text-xs backdrop-blur-md
                  ${isWhiteTheme ? "bg-white/95 border-gray-200 text-gray-800" : "bg-zinc-900/95 border-zinc-700 text-zinc-200"}
                `}
              >
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-zinc-400 border-b border-zinc-700/50 mb-0.5">
                  Insert JSON Preset
                </div>
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className={`
                      w-full text-left px-2.5 py-1.5 text-[11px] font-medium transition-colors flex items-center justify-between
                      ${isWhiteTheme ? "hover:bg-blue-50 hover:text-blue-600" : "hover:bg-blue-600/20 hover:text-blue-400"}
                    `}
                  >
                    <span>{tpl.name}</span>
                    <span className="text-[10px] opacity-50 font-mono">{Array.isArray(tpl.json) ? "[]" : "{}"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={copyJSON}
            className={`
              px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all
              ${copied
                ? "bg-emerald-600 text-white"
                : isWhiteTheme
                ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }
            `}
            title="Copy JSON to clipboard"
          >
            {copied ? (
              <>
                <span>✓</span>
                <span>Copied</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Editor Area ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 font-mono text-xs overflow-hidden relative">
        {/* Line numbers gutter */}
        <div
          ref={gutterRef}
          className={`
            w-10 text-right pr-2 pt-2.5 pb-4 select-none font-mono text-[11px] leading-5 shrink-0 overflow-hidden border-r
            ${isWhiteTheme ? "bg-gray-50/80 border-gray-200 text-gray-400" : "bg-[#14151a] border-zinc-800 text-zinc-600"}
          `}
        >
          {lines.map((num) => (
            <div
              key={num}
              className={`h-5 transition-colors ${
                num === activeLine
                  ? isWhiteTheme
                    ? "text-blue-600 font-bold bg-blue-50/80 -mr-2 pr-2"
                    : "text-blue-400 font-bold bg-blue-900/20 -mr-2 pr-2"
                  : ""
              }`}
            >
              {num}
            </div>
          ))}
        </div>

        {/* Textarea Code Editor */}
        <textarea
          ref={textareaRef}
          value={value || ""}
          onChange={(e) => {
            setter(e.target.value);
            updateCursorPosition();
          }}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          className={`
            flex-1 pt-2.5 pl-3.5 pr-3 pb-4 outline-none resize-none font-mono text-[12px] leading-5 overflow-auto custom-scrollbar
            ${isWhiteTheme ? "bg-white text-gray-800 selection:bg-blue-100" : "bg-[#111216] text-zinc-200 selection:bg-blue-900/50"}
          `}
          placeholder={`{\n  "key": "value"\n}`}
          spellCheck="false"
          wrap="off"
        />
      </div>

      {/* ─── Footer with Diagnostics & Controls ────────────────── */}
      <div
        className={`
          px-3 py-1.5 flex items-center justify-between border-t shrink-0 h-10
          ${borderColor}
          ${isWhiteTheme ? "bg-gray-50/90" : "bg-[#16171d]"}
        `}
      >
        {/* Error message or active line feedback */}
        <div className="flex-1 min-w-0 pr-3 truncate">
          {error ? (
            <span className="text-rose-400 font-medium text-[11px] truncate flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 animate-ping" />
              <span className="truncate">{error}</span>
            </span>
          ) : (
            <span className="text-zinc-500 text-[11px] font-mono flex items-center gap-2">
              <span>Ln {activeLine}, Col {activeCol}</span>
              <span>•</span>
              <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={minifyJSON}
            className={`
              px-2.5 py-1 rounded text-[11px] font-medium transition-all
              ${isWhiteTheme
                ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }
            `}
            title="Compact / Minify JSON into a single line"
          >
            Minify
          </button>
          <button
            type="button"
            onClick={formatJSON}
            className="
              px-3 py-1 rounded text-[11px] font-medium transition-all
              bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            "
            title="Format & Indent JSON (2 spaces)"
          >
            Format JSON
          </button>
        </div>
      </div>
    </div>
  );
};

const RequestResponsePanels = React.memo(({
  requestBody,
  setRequestBody,
  responseBody,
  setResponseBody,
  w
}) => {
  const [requestError, setRequestError] = useState("");
  const [responseError, setResponseError] = useState("");

  const isWhiteTheme = w;
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";

  // Validate request JSON
  useEffect(() => {
    if (!requestBody || !requestBody.trim() || requestBody === "{\n  \n}") {
      setRequestError("");
      return;
    }
    try {
      JSON.parse(requestBody);
      setRequestError("");
    } catch (err) {
      setRequestError(err.message);
    }
  }, [requestBody]);

  // Validate response JSON
  useEffect(() => {
    if (!responseBody || !responseBody.trim() || responseBody === "{\n  \n}") {
      setResponseError("");
      return;
    }
    try {
      JSON.parse(responseBody);
      setResponseError("");
    } catch (err) {
      setResponseError(err.message);
    }
  }, [responseBody]);

  return (
    <div
      className={`
        grid grid-cols-1 md:grid-cols-2 gap-0 w-full h-[400px] min-h-[400px] shrink-0 rounded-xl border shadow-sm
        ${borderColor}
        overflow-hidden font-mono
      `}
    >
      <JsonEditorPanel
        label="📤 Request Input"
        value={requestBody}
        setter={setRequestBody}
        error={requestError}
        setError={setRequestError}
        isWhiteTheme={isWhiteTheme}
        borderColor={borderColor}
        isRightPanel={false}
      />
      <JsonEditorPanel
        label="📥 Response Blueprint"
        value={responseBody}
        setter={setResponseBody}
        error={responseError}
        setError={setResponseError}
        isWhiteTheme={isWhiteTheme}
        borderColor={borderColor}
        isRightPanel={true}
      />
    </div>
  );
});

RequestResponsePanels.displayName = "RequestResponsePanels";

export default RequestResponsePanels;
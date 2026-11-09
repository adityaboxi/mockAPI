// src/components/maincomponentmemo/MethodSelect.jsx
import React from "react";

// Top-level static constants to prevent object/array allocation on every render
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

const METHOD_COLOR_MAP = {
  GET: "text-emerald-500",
  POST: "text-blue-500",
  PUT: "text-amber-500",
  PATCH: "text-orange-500",
  DELETE: "text-rose-500",
  OPTIONS: "text-purple-400",
};

const THEME_CLASSES = {
  white: {
    select: "bg-white border border-gray-300 hover:border-blue-400 focus:ring-offset-white",
    option: "bg-white text-gray-800",
  },
  dark: {
    select: "bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 focus:ring-offset-zinc-900",
    option: "bg-zinc-900 text-zinc-100",
  },
};

const MethodSelect = React.memo(({ method = "GET", setMethod, w = false }) => {
  const styles = w ? THEME_CLASSES.white : THEME_CLASSES.dark;
  const selectedColor = METHOD_COLOR_MAP[method] || "text-zinc-400";

  return (
    <select
      value={method}
      onChange={(e) => setMethod?.(e.target.value)}
      aria-label="HTTP Method Selector"
      className={`
        rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide outline-none cursor-pointer
        transition-all duration-200 uppercase font-mono
        ${styles.select}
        ${selectedColor}
        focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
        appearance-none pr-7
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
        bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat
      `}
    >
      {HTTP_METHODS.map((m) => (
        <option key={m} value={m} className={styles.option}>
          {m}
        </option>
      ))}
    </select>
  );
});

MethodSelect.displayName = "MethodSelect";

export default MethodSelect;
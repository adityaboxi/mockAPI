import React from "react";

const ProtocolSelect = React.memo(({ protocol, setProtocol, w }) => {
  const isWhiteTheme = w;
  
  return (
    <select
      value={protocol}
      onChange={(e) => setProtocol(e.target.value)}
      className={`
        rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide outline-none cursor-pointer
        transition-all duration-200
        ${isWhiteTheme
          ? "bg-white border border-gray-300 text-blue-600 hover:border-blue-400"
          : "bg-zinc-800 border border-zinc-700 text-blue-400 hover:border-blue-500/50"
        }
        focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
        appearance-none
        pr-7
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
        bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat
      `}
    >
      <option value="http">http</option>
      <option value="https">https</option>
    </select>
  );
});

export default ProtocolSelect;
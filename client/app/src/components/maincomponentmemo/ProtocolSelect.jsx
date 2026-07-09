import React from "react";

const ProtocolSelect = React.memo(({ protocol, setProtocol, w }) => {
  return (
    <select
      value={protocol}
      onChange={(e) => setProtocol(e.target.value)}
      className={`border rounded px-2 py-1.5 text-blue-500 font-semibold text-xs outline-none cursor-pointer ${w ? "bg-white border-gray-300" : "bg-[#2b2d31] border-zinc-700/50"}`}
    >
      <option value="http">http</option>
      <option value="https">https</option>
    </select>
  );
});

export default ProtocolSelect;
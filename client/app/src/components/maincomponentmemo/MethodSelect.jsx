import React from "react";

const MethodSelect = React.memo(({ method, setMethod, w }) => {
  return (
    <select
      value={method}
      onChange={(e) => setMethod(e.target.value)}
      className={`border rounded px-2 py-1.5 font-semibold text-xs outline-none cursor-pointer ${
        method === 'GET'    ? 'text-green-500' :
        method === 'POST'   ? 'text-blue-500'  :
        method === 'PUT'    ? 'text-yellow-500' :
        method === 'PATCH'  ? 'text-orange-500' :
        'text-red-500'
      } ${w ? "bg-white border-gray-300" : "bg-[#2b2d31] border-zinc-700/50"}`}
    >
      {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
    </select>
  );
});

export default MethodSelect;
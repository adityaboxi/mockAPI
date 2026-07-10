/*import React from "react";

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

export default MethodSelect;*/


import React from "react";

const METHOD_COLORS = {
  GET: "text-green-500",
  POST: "text-blue-500",
  PUT: "text-yellow-500",
  PATCH: "text-orange-500",
  DELETE: "text-red-500",
};

const MethodSelect = React.memo(({ method, setMethod, w }) => {
  const colorClass = METHOD_COLORS[method] || "text-gray-500";

  return (
    <select
      value={method}
      onChange={(e) => setMethod(e.target.value)}
      className={`border rounded px-2 py-1.5 font-semibold text-xs outline-none cursor-pointer ${colorClass} ${
        w ? "bg-white border-gray-300" : "bg-[#2b2d31] border-zinc-700/50"
      }`}
    >
      {Object.keys(METHOD_COLORS).map((m) => (
        <option key={m}>{m}</option>
      ))}
    </select>
  );
});

export default MethodSelect;
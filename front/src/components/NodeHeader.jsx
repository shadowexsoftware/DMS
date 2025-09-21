// src/components/NodeHeader.jsx
import React from "react";

export default function NodeHeader({ head }) {
  if (!head) return null;

  const Item = ({ label, value }) => {
    const display = (value ?? "").toString().trim();
    return (
      <div className="flex items-start gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 min-h-10">
        <span className="text-slate-500 shrink-0">{label}</span>
        {/* переносы включены, место под текст есть */}
        <span className="flex-1 whitespace-normal break-words">
          {display || "—"}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Item label="Наименование:" value={head.name} />
      <Item label="Код детали:" value={head.materialCode} />
      <Item label="Рабочие часы:" value={head.manHour} />
      <Item label="Крутящий момент:" value={head.torque} />
      <Item label="Важность крутящего момента:" value={head.torqueDegree} />
    </div>
  );
}

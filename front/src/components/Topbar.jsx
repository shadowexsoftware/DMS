// src/components/Topbar.jsx
import React from "react";

export default function Topbar({ modelOptions, value, onChange, onSearch, onLogout }) {
  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 p-3 flex-wrap">
        <span className="text-lg font-bold">DMS Viewer</span>

        <label className="text-slate-500">Модель:</label>
        <select
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          className="min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"
        >
          <option value="">— не загружено —</option>
          {modelOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={onSearch}
          className="h-9 px-3 rounded-lg bg-indigo-600 text-white hover:brightness-95"
        >
          Поиск
        </button>

        <span className="flex-1" />

        <button
          onClick={onLogout}
          className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          Выход
        </button>
      </div>
    </header>
  );
}

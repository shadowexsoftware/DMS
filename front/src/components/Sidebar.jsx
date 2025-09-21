// src/components/Sidebar.jsx
import React, { useMemo, useState } from "react";

export default function Sidebar({
  width = 340,
  q,            // применённая строка поиска (используется хуком)
  setQ,         // установить применённую строку (по клику на лупу/крестик)
  sortMode,
  setSortMode,
  treeEl
}) {
  // Локальный «черновик» ввода — не триггерит поиск, пока не нажали лупу.
  const [draft, setDraft] = useState(q || "");

  // Порог длины первого слова
  const MIN_CHARS = 3;

  // Первый токен из draft
  const firstToken = useMemo(() => {
    const norm = String(draft || "").trim().toLowerCase();
    return norm.split(/\s+/).filter(Boolean)[0] || "";
  }, [draft]);

  const canSearch = firstToken.length >= MIN_CHARS;

  function applySearch() {
    // Применяем введённое — это «активирует» поиск/раскрытие в хуке
    setQ(draft);
  }

  function clearSearch() {
    setDraft("");
    setQ(""); // сбросить фильтр
  }

  function onKeyDown(e){
    if (e.key === "Enter" && canSearch) {
      applySearch();
    }
  }

  return (
    <aside
      style={{ width }}
      className="min-w-[240px] max-w-[560px] p-3 border-r border-slate-200 dark:border-slate-700
                 bg-white dark:bg-slate-900 overflow-auto custom-scroll"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-stretch gap-1 flex-1">
          <input
            value={draft}
            onChange={(e)=>setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            type="search"
            placeholder={`Введите слово (≥ ${MIN_CHARS} символов)`}
            className="flex-1 min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
          />
          {/* Лупа — применить поиск */}
          <button
            onClick={applySearch}
            disabled={!canSearch}
            title={canSearch ? "Искать по title" : `Минимум ${MIN_CHARS} символов в первом слове`}
            className={
              "min-h-9 px-2 rounded-lg border " +
              (canSearch
                ? "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                : "border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed")
            }
          >
            {/* SVG-иконка лупы */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="7" strokeWidth="2"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2"/>
            </svg>
          </button>
          {/* Крестик — сброс */}
          <button
            onClick={clearSearch}
            title="Сбросить поиск"
            className="min-h-9 px-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {/* SVG-иконка крестика */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <select
          value={sortMode}
          onChange={(e)=>setSortMode(e.target.value)}
          className="min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"
        >
          <option value="default">сортировка</option>
          <option value="name_asc">A→Я (имя)</option>
          <option value="name_desc">Я→A (имя)</option>
          <option value="code_asc">A→Z (код)</option>
          <option value="code_desc">Z→A (код)</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50">
        {treeEl}
      </div>

      {/* Подсказка статуса поиска */}
      <div className="mt-2 text-xs text-slate-500">
        {q
          ? <>Поиск активен по: <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{q}</code></>
          : <>Поиск не активен</>
        }
      </div>
    </aside>
  );
}

//src/components/PagesSidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";

function Item({ to, icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors " +
        (isActive
          ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200")
      }
    >
      <span className="w-5 h-5 shrink-0" aria-hidden="true">{icon}</span>
      <span className="truncate">{children}</span>
    </NavLink>
  );
}

/**
 * Боковое меню.
 * - На мобильных (width < md) — выезжает слева (fixed + translate-x).
 * - На десктопе — статичная колонка; когда закрыто, скрыта (отдаёт всю ширину контенту).
 */
export default function PagesSidebar({ open, onClose }) {
  return (
    <aside
      aria-hidden={!open}
      className={
        // базовая геометрия
        "z-40 w-[260px] shrink-0 border-r border-slate-200 dark:border-slate-700 " +
        "bg-white dark:bg-slate-900 p-3 space-y-2 " +
        // поведение на мобильных: фиксированная панель, выезжает трансформацией
        "fixed inset-y-0 left-0 transform transition-transform duration-200 " +
        (open ? "translate-x-0" : "-translate-x-full") + " " +
        // на md+ делаем статичной и всегда видимой/скрываем по open
        "md:static md:translate-x-0 " + (open ? "" : "md:hidden")
      }
    >
      {/* Заголовок/логотип + крестик на мобильных */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">DMS</div>
        <button
          onClick={onClose}
          className="md:hidden rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Закрыть меню"
          title="Закрыть меню"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="space-y-1">
        <Item
          to="/business"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 12l9-9 9 9" strokeWidth="2" />
              <path d="M4 10v10h16V10" strokeWidth="2" />
            </svg>
          }
        >
          Главная страница бизнеса
        </Item>

        <Item
          to="/service"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M12 8v4l2.5 2.5" strokeWidth="2" />
            </svg>
          }
        >
          Запрос на техническое обслуживание
        </Item>
      </div>
    </aside>
  );
}

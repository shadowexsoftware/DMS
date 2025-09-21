//src/layouts/PagesLayout.jsx

import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PagesSidebar from "../components/PagesSidebar.jsx";

/** Лэйаут с левым меню страниц */
export default function PagesLayout() {
  const [open, setOpen] = useState(true);      // состояние меню
  const loc = useLocation();

  // Автозакрыть выезжающее меню при смене маршрута на мобильных
  useEffect(() => {
    // на md+ оставляем как есть, на <md закрываем
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
  }, [loc.pathname]);

  return (
    <div className="flex min-h-[100vh]">
      {/* Боковое меню (фиксированное на мобильных, статичное на md+) */}
      <PagesSidebar open={open} onClose={() => setOpen(false)} />

      {/* Правая часть */}
      <div className="flex-1 min-w-0 relative bg-slate-50 dark:bg-slate-950">
        {/* Кнопка-бургер (показывается всегда, на md+ просто сворачивает панель) */}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="Переключить меню"
          className="m-2 inline-flex items-center gap-2 rounded-lg border
                     border-slate-300 dark:border-slate-700
                     bg-white dark:bg-slate-900 px-3 py-2 text-sm
                     hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {/* иконка */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" />
            <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" />
            <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" />
          </svg>
          Меню
        </button>

        {/* Контент страницы */}
        <div className="min-w-0">
          <Outlet />
        </div>

        {/* Полупрозрачный оверлей на мобильных, чтобы закрывать кликoм вне меню */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-30 bg-black/30"
          />
        )}
      </div>
    </div>
  );
}

//src/pages/BusinessHome.jsx

import React, { useState } from "react";

export default function BusinessHome() {
  const [open, setOpen] = useState(true); // просто сворачивание контента секции

  return (
    <div className="min-h-[100vh] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="p-3 sm:p-4">
        {/* Шапка страницы */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-2 text-left"
            title={open ? "Свернуть" : "Развернуть"}
          >
            <svg
              className={"w-4 h-4 transition-transform " + (open ? "rotate-90" : "")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <h1 className="text-base sm:text-lg font-semibold">Главная страница бизнеса</h1>
          </button>

          {/* Выбор языка (визуально) */}
          <select
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
            defaultValue="ru"
            aria-label="Язык"
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
            <option value="kk">Қазақша</option>
          </select>
        </div>

        {/* Панель содержимого */}
        {open && (
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4">
            {/* VIN и кнопки справа */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <label className="flex items-center gap-3 w-full sm:max-w-[520px]">
                <span className="shrink-0 w-16 text-sm text-slate-600 dark:text-slate-300">VIN:</span>
                <input
                  type="text"
                  placeholder="Введите"
                  className="flex-1 min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                  title="Запросить"
                >
                  Запросить
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Сбросить"
                >
                  Сбросить
                </button>
              </div>
            </div>

            {/* Информация об автомобиле */}
            <h2 className="mt-6 mb-2 font-semibold text-slate-700 dark:text-slate-200">
              Информация об автомобиле
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
              <Field label="VIN" />
              <Field label="Модель и серия автомобиля" />
              <Field label="Номерной знак" />
              <div /> {/* пустая ячейка для выравнивания как на скрине */}
            </div>

            {/* Информация о пользователе */}
            <h2 className="mt-8 mb-2 font-semibold text-slate-700 dark:text-slate-200">
              Информация о пользователе
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
              <Field label="Тип" />
              <Field label="KYC-проверка" />
              <Field label="Ф.И.О." />
              <Field label="Номер удостоверения личности" />
              <Field label="Пол" />
              <Field label="Дата рождения" />
              <Field label="Гражданство" />
              <Field label="Адрес проживания" />
              <Field label="Мобильный телефон" />
              <Field label="Электронная почта" />
              <Field label="Приложение (свидетельство о регистрации ТС, водительские права, паспорт и т.д.)" />
              <div /> {/* пустая для выравнивания */}
            </div>

            {/* Нижние кнопки */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                Создать лист оценки стоимости
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                KYC-проверка
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                Создать заказ на работу
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Простой статичный «лейбл + пустое значение» */
function Field({ label }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-3">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="h-9 rounded-lg border border-transparent bg-transparent text-slate-400 dark:text-slate-500">
        {/* Пусто — как серый плейсхолдер на макете */}
      </div>
    </div>
  );
}

// src/components/NodeTabs.jsx
import React from "react";

/**
 * NodeTabs
 * - отключает кнопки, если данных нет (по флагам available)
 * - показывает подсказку при наведении
 * - вкладка "Информация о деталях" (part) всегда доступна — данные обычно есть
 *
 * expected available = {
 *   img: boolean,
 *   fdesc: boolean,
 *   tech: boolean,
 *   circuit: boolean,
 *   steps: boolean,
 * }
 */
export default function NodeTabs({ onShow, code, available = {} }) {
  const base =
    "px-3 py-2 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed";
  const normal =
    "bg-indigo-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-indigo-100 dark:border-slate-700 hover:brightness-95";
  const primary =
    "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-700/10";

  const Btn = ({ disabled, title, children, onClick }) => (
    <button
      className={`${base} ${normal}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn
        disabled={!available.img}
        title={available.img ? "Открыть изображение" : "Нет изображения для этой детали"}
        onClick={() => onShow(code, "img")}
      >
        Изображение
      </Btn>

      <Btn
        disabled={!available.fdesc}
        title={available.fdesc ? "Описание функции" : "Нет описания функции"}
        onClick={() => onShow(code, "fdesc")}
      >
        Описание функции
      </Btn>

      <Btn
        disabled={!available.tech}
        title={available.tech ? "Технические данные" : "Нет техданных"}
        onClick={() => onShow(code, "tech")}
      >
        Тех. данные
      </Btn>

      <Btn
        disabled={!available.circuit}
        title={available.circuit ? "Электрическая схема" : "Нет электрической схемы"}
        onClick={() => onShow(code, "circuit")}
      >
        Электрическая схема
      </Btn>

      <Btn
        disabled={!available.steps}
        title={available.steps ? "Шаги разборки/сборки" : "Нет шагов разборки/сборки"}
        onClick={() => onShow(code, "steps")}
      >
        Шаги разборки и сборки
      </Btn>

      {/* Обычно сведения по детали (part) доступны — оставляем всегда активной */}
      <Btn title="Информация о деталях" onClick={() => onShow(code, "part")}>
        Информация о деталях
      </Btn>

      <button
        onClick={() => onShow(code, "export")}
        className={`${base} ${primary}`}
        title="Сформировать документ DOCX со всеми данными по детали"
      >
        ⇩ Скачать документ
      </button>
    </div>
  );
}

//src/pages/Viewer/components/CircuitPopup.jsx

import React, { useEffect } from "react";

/**
 * Модальное окно с деталями хотспота схемы.
 * props:
 *  - open: boolean
 *  - hotspot: объект хотспота (hotspotNum/hotspotName/hotspotType)
 *  - detail: ответ API /api/circuit_click
 *  - onClose: () => void
 *  - onImageClick: (url: string) => void
 */
export default function CircuitPopup({ open, hotspot, detail, onClose, onImageClick }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const titleCode =
    String(hotspot?.hotspotNum || hotspot?.hotspotName || "").trim() || "Элемент";

  const plug = detail?.plugTo;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[min(920px,calc(100vw-2rem))]
                   max-h-[min(86vh,calc(100vh-2rem))] -translate-x-1/2 -translate-y-1/2
                   rounded-xl bg-white text-slate-900 shadow-2xl border border-slate-200
                   flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="font-semibold text-slate-800">
            {titleCode}
            {plug ? (
              <span className="ml-2 font-normal text-slate-600">
                Разъём: {plug.name || plug.plugNumber}
              </span>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-auto space-y-4">
          {"__error" in (detail || {}) ? (
            <div className="text-red-600">
              Ошибка: {detail.__error}
            </div>
          ) : plug ? (
            <>
              {Array.isArray(plug.detailList) && plug.detailList.length > 0 && (
                <section>
                  <div className="text-xs mb-2 text-slate-600">Изображения</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {plug.detailList.map((d) => (
                      <figure key={d.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                        <img
                          src={d.fileUrl}
                          alt={d.name}
                          className="block w-full h-auto"
                          onClick={() => onImageClick?.(d.fileUrl)}
                          style={{ cursor: "zoom-in" }}
                        />
                        <figcaption className="text-[12px] px-2 py-1 border-t border-slate-200">
                          {d.name}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              {Array.isArray(plug.pinList) && plug.pinList.length > 0 && (
                <section>
                  <div className="text-xs mb-2 text-slate-600">Таблица пинов</div>
                  <div className="overflow-auto">
                    <table className="min-w-[520px] text-xs border border-slate-200 text-slate-800">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-1 border-b">Информация о штепселе</th>
                          <th className="text-left px-2 py-1 border-b">Цвет жгута проводов</th>
                          <th className="text-left px-2 py-1 border-b">Определение контакта</th>
                          <th className="text-left px-2 py-1 border-b">Номинальное значение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plug.pinList.map((p) => (
                          <tr key={p.id} className="odd:bg-white even:bg-slate-50">
                            <td className="px-2 py-1">{p.pinNumber}</td>
                            <td className="px-2 py-1">{p.wireColor}</td>
                            <td className="px-2 py-1">{p.definition}</td>
                            <td className="px-2 py-1">{p.standardValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {!plug.detailList?.length && !plug.pinList?.length && (
                <div className="text-slate-600">Нет детальных данных для этого элемента.</div>
              )}
            </>
          ) : (
            <div className="text-slate-600">Нет детальной карточки для этого элемента.</div>
          )}
        </div>
      </div>
    </div>
  );
}

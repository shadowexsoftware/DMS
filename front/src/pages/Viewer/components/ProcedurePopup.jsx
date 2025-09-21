// src/pages/Viewer/components/ProcedurePopup.jsx
import React, { useEffect } from "react";

export default function ProcedurePopup({ open, title, data, onClose, onImageClick }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabs = Array.isArray(data?.tab) ? data.tab : [];
  const header = String(title || data?.content || "Процедура").trim();

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-2rem))]
                   max-h-[min(90vh,calc(100vh-2rem))] -translate-x-1/2 -translate-y-1/2
                   rounded-xl bg-white text-slate-900 shadow-2xl border border-slate-200
                   flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="font-semibold text-slate-800">{header}</div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-auto space-y-6">
          {data?.matterWarn && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium mb-1">Предупреждение</div>
              <div dangerouslySetInnerHTML={{ __html: data.matterWarn }} />
            </div>
          )}
          {data?.matterNotice && (
            <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
              <div className="font-medium mb-1">Примечание</div>
              <div dangerouslySetInnerHTML={{ __html: data.matterNotice }} />
            </div>
          )}

          {tabs.length === 0 && (
            <div className="text-slate-600">Нет табов/деталей для этой процедуры.</div>
          )}

          {tabs.map((t) => {
            const details = Array.isArray(t.detail) ? t.detail : [];
            return (
              <section key={t.id || t.tabCode} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  {t.labelName || "Шаги"}
                </h3>

                {details.length === 0 ? (
                  <div className="text-slate-600 text-sm">
                    Нет подробностей в этом табе.
                  </div>
                ) : (
                  <ol className="space-y-4 list-decimal ml-4">
                    {details.map((d) => (
                      <li key={d.id || d.detailCode} className="space-y-2">
                        {d.fileUrl ? (
                          <figure className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                            <img
                              src={d.fileUrl}
                              alt={d.resourceCode || ""}
                              className="block w-full h-auto"
                              onClick={() => onImageClick?.(d.fileUrl)}
                              style={{ cursor: "zoom-in" }}
                            />
                          </figure>
                        ) : null}

                        {d.content ? (
                          <div
                            className="prose prose-sm max-w-none prose-p:my-1"
                            dangerouslySetInnerHTML={{ __html: d.content }}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

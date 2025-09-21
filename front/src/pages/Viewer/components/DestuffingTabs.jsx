// src/pages/Viewer/components/DestuffingTabs.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import API from "../../../api/dms.js";
import Lightbox from "./Lightbox.jsx";
import ProcedurePopup from "./ProcedurePopup.jsx";

/**
 * Панель «Шаги разборки и сборки деталей» с табами и встроенной «деталкой».
 *
 * props:
 *  - structureCode: string (обязателен)
 */

// Простой диалог (оверлей) для карточек сверху (в базовом режиме)
function Dialog({ open, title, children, onClose, widthClass = "w-[min(980px,calc(100vw-2rem))]" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1300]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute left-1/2 top-1/2 ${widthClass}
                    max-h-[min(90vh,calc(100vh-2rem))] -translate-x-1/2 -translate-y-1/2
                    rounded-xl bg-white text-slate-900 shadow-2xl border border-slate-200
                    flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="font-semibold text-slate-800">{title}</div>
          <button
            className="px-2 py-1 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            onClick={onClose}
            title="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export default function DestuffingTabs({ structureCode }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  // лайтбокс
  const [lbOpen, setLbOpen] = useState(false);
  const [lbSrc, setLbSrc] = useState("");
  const [lbAlt, setLbAlt] = useState("");

  // поп-ап процедур PD-...
  const [procOpen, setProcOpen] = useState(false);
  const [procTitle, setProcTitle] = useState("");
  const [procData, setProcData] = useState(null);

  // активный таб в обычном режиме
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  // встроенный режим «деталка» (стек для углублений)
  const [detailStack, setDetailStack] = useState([]); // [{ title, tabs, id, info, notes, warns, loc }]
  const inDetail = detailStack.length > 0;
  const currentDetail = inDetail ? detailStack[detailStack.length - 1] : null;

  // диалоги «карточек» (базовый режим)
  const [infoDlg, setInfoDlg] = useState(false);
  const [locDlg, setLocDlg] = useState(false);
  const [notesDlg, setNotesDlg] = useState(false);
  const [warnsDlg, setWarnsDlg] = useState(false);

  // ===== Загрузка базовых шагов по structureCode =====
  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setErr("");
      setData(null);
      setActiveTabIdx(0);
      setDetailStack([]); // сброс «деталки» при смене узла
      try {
        const res = await API.destuffing(structureCode);
        const d = res?.data ?? res;
        if (!alive) return;
        setData(d?.data ?? d);
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (structureCode) run();
    return () => { alive = false; };
  }, [structureCode]);

  // ===== Подготовка табов для обычного режима =====
  const tabs = useMemo(() => {
    const raw = Array.isArray(data?.tabDToList) ? data.tabDToList : [];
    const sorted = raw.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    return sorted.map((t) => ({
      ...t,
      detailList: Array.isArray(t.stepToList)
        ? t.stepToList.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        : [],
    }));
  }, [data]);

  // выбрать первый таб с шагами
  useEffect(() => {
    if (!tabs.length) return;
    const idx = Math.max(0, tabs.findIndex((t) => t.detailList.length > 0));
    setActiveTabIdx(idx === -1 ? 0 : idx);
  }, [tabs]);

  const activeTab = tabs[activeTabIdx] || null;

  const info = data?.destuffingNewTo || {};
  const notes = Array.isArray(data?.attentionList) ? data.attentionList : [];
  const warns = Array.isArray(data?.warningList) ? data.warningList : [];
  const loc = data?.materialLocation || null;

  // ===== Перечень одноразовых деталей с бэка (material_list) =====
  const [mlRows, setMlRows] = useState(null); // null=загрузка/ещё не пробовали, []=пусто
  const [mlErr, setMlErr] = useState("");
  useEffect(() => {
    const did = info?.destuffingId || info?.destuffingCode;
    if (!did) { setMlRows([]); setMlErr(""); return; }
    let alive = true;
    setMlRows(null);
    setMlErr("");
    (async () => {
       try {
        const res = await API.materialList({
          pageNo: 1,
          pageSize: 200,
          param: { destuffingId: String(did), bizCodeList: null, materialType: 10 },
        });
        // Универсальный «двойной» анwrap: работает и с axios-подобным ответом, и с plain fetch
        const p = res?.data ?? res;       // { code, data, ... } или уже inner data
        const d = p?.data ?? p;           // inner data
        const rows = Array.isArray(d?.results) ? d.results : [];
        if (alive) setMlRows(rows);
      } catch (e) {
        if (alive) {
          setMlRows([]);
          setMlErr(String(e?.message || e));
        }
      }
    })();
    return () => { alive = false; };
  }, [info?.destuffingId, info?.destuffingCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Хелперы для «деталки» (destuffing_by_id) =====
  function normalizeDestuffingByIdPayload(payload, fallbackTitle) {
    const d = payload?.data ?? payload ?? {};
    const title =
      d?.destuffingNewTo?.materialName ||
      d?.destuffingNewTo?.remarks ||
      fallbackTitle ||
      d?.destuffingNewTo?.destuffingId ||
      "";

    const tabs = (Array.isArray(d?.tabDToList) ? d.tabDToList : []).map((t) => ({
      labelName: t?.labelName || "",
      items: (Array.isArray(t?.stepToList) ? t.stepToList : []).map((s) => ({
        fileUrl: s?.fileUrl || null,
        fileType: s?.fileType ?? null,
        html: s?.stepExplain || "", // HTML шага
        _raw: s,
      })),
    }));

    // ВАЖНО: прокидываем инфо/заметки/предупреждения/положение детали
    return {
      id: d?.destuffingNewTo?.destuffingId || fallbackTitle || "",
      title,
      tabs,
      info: d?.destuffingNewTo || {},
      notes: Array.isArray(d?.attentionList) ? d.attentionList : [],
      warns: Array.isArray(d?.warningList) ? d?.warningList : [],
      loc: d?.materialLocation || null,
    };
  }

  const openDetailById = useCallback(async (destuffingId, linkText = "") => {
    try {
      const res = await API.destuffingById(destuffingId);
      const normalized = normalizeDestuffingByIdPayload(res, linkText);
      setDetailStack((st) => [...st, normalized]);
    } catch (e) {
      setProcTitle(linkText || String(destuffingId));
      setProcData({ __error: String(e?.message || e) });
      setProcOpen(true);
    }
  }, []);

  const detailBack = useCallback(() => {
    setDetailStack((st) => (st.length ? st.slice(0, -1) : st));
  }, []);

  const detailClose = useCallback(() => {
    setDetailStack([]);
  }, []);

  // ===== Единый обработчик кликов по HTML шагов =====
  const onHtmlClick = useCallback(
    async (e) => {
      const a = e.target.closest("a[id]");
      if (!a) return;
      const pid = String(a.getAttribute("id") || "").trim();
      if (!pid) return;

      // Процедуры PD-... — открываем поп-ап
      if (/^PD-[\w-]+$/i.test(pid)) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const res = await API.procedure(pid);
          const payload = res?.data ?? res;
          const d = payload?.data ?? payload;
          setProcTitle(a.textContent || d?.content || pid);
          setProcData(d);
          setProcOpen(true);
        } catch (err) {
          setProcTitle(pid);
          setProcData({ __error: String(err?.message || err) });
          setProcOpen(true);
        }
        return;
      }

      // Числовые relationCode — открываем «деталку»
      if (/^\d{6,}$/.test(pid)) {
        e.preventDefault();
        e.stopPropagation();
        await openDetailById(pid, a.textContent || pid);
      }
    },
    [openDetailById]
  );

  // ===== Рендер «деталки» =====
  const renderDetailView = (view) => {
    const vInfo = view.info || {};
    const vNotes = Array.isArray(view.notes) ? view.notes : [];
    const vWarns = Array.isArray(view.warns) ? view.warns : [];
    const vLoc = view.loc || null;

    return (
      <div className="rounded-xl border border-slate-200 bg-white flex flex-col">
        {/* Заголовок с управлением */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {detailStack.length > 1 ? (
              <button
                className="px-2 py-1 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
                onClick={detailBack}
                title="Назад"
              >
                ← Назад
              </button>
            ) : (
              <button
                className="px-2 py-1 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
                onClick={detailClose}
                title="Закрыть"
              >
                ✕
              </button>
            )}
            <div className="font-semibold text-slate-800">{view.title || "Деталь"}</div>
          </div>
          {view.id ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
              ID: {view.id}
            </span>
          ) : null}
        </div>

        {/* Контент */}
        <div className="p-4 overflow-auto space-y-6">
          {/* ВЕРХНИЕ КВАДРАТЫ внутри детального поп-апа */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Основная информация */}
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-sm font-semibold mb-2">Основная информация</div>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Наименование детали:</dt>
                  <dd className="text-right text-slate-900">{vInfo?.materialName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Номер детали:</dt>
                  <dd className="text-right text-slate-900">{vInfo?.materialCode || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Идентификатор шагов:</dt>
                  <dd className="text-right text-slate-900">{vInfo?.destuffingId || vInfo?.destuffingCode || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Текущая версия:</dt>
                  <dd className="text-right text-slate-900">{vInfo?.edition ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Норма времени:</dt>
                  <dd className="text-right text-slate-900">
                    {vInfo?.manHour || "—"}
                    {typeof vInfo?.hours === "number" ? ` (≈${vInfo.hours} ч)` : ""}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Положение детали */}
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-sm font-semibold mb-2">Положение детали</div>
              {vLoc?.fileUrl ? (
                <img
                  src={vLoc.fileUrl}
                  alt="Положение детали"
                  className="block w-full h-auto rounded-lg border border-slate-200"
                  onClick={() => { setLbSrc(vLoc.fileUrl); setLbAlt("Положение детали"); setLbOpen(true); }}
                  style={{ cursor: "zoom-in" }}
                />
              ) : (
                <div className="text-slate-500 text-sm">Нет изображения.</div>
              )}
            </section>

            {/* Особые замечания */}
            <section className="rounded-xl border border-slate-200 bg-amber-50 p-3">
              <div className="text-sm font-semibold mb-2">Особые замечания</div>
              {vNotes.length ? (
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {vNotes.map((n, i) => (
                    <li key={`${n.textCode || i}`}>
                      <div className="text-slate-900 whitespace-pre-line">{n.content || ""}</div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-slate-500 text-sm">Нет.</div>
              )}
            </section>

            {/* Предупреждение */}
            <section className="rounded-xl border border-slate-200 bg-rose-50 p-3">
              <div className="text-sm font-semibold mb-2">Предупреждение</div>
              {vWarns.length ? (
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {vWarns.map((w, i) => (
                    <li key={`${w.textCode || i}`}>
                      <div className="text-slate-900 whitespace-pre-line">{w.content || ""}</div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-slate-500 text-sm">Нет.</div>
              )}
            </section>
          </div>

          {/* СЕКЦИИ ШАГОВ */}
          {Array.isArray(view.tabs) && view.tabs.length ? (
            view.tabs.map((t, idx) => (
              <section className="space-y-3" key={`${t.labelName || "tab"}-${idx}`}>
                <h3 className="text-sm font-semibold text-slate-700">{t.labelName || `Секция ${idx + 1}`}</h3>
                {Array.isArray(t.items) && t.items.length ? (
                  <ol className="space-y-4 list-decimal ml-4">
                    {t.items.map((it, i) => (
                      <li className="space-y-2" key={i}>
                        {it.fileUrl ? (
                          <figure className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                            <img
                              alt=""
                              className="block w-full h-auto"
                              src={it.fileUrl}
                              style={{ cursor: "zoom-in" }}
                              onClick={() => {
                                setLbSrc(it.fileUrl);
                                setLbAlt("");
                                setLbOpen(true);
                              }}
                            />
                          </figure>
                        ) : null}
                        {it.html ? (
                          <div
                            className="prose prose-slate prose-sm max-w-none text-slate-900
                                       prose-p:my-1 prose-li:text-slate-900
                                       prose-a:text-indigo-700 hover:prose-a:underline
                                       safe-html"
                            dangerouslySetInnerHTML={{ __html: it.html }}
                            onClick={onHtmlClick}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="text-slate-600 text-sm">Нет подробностей в этом табе.</div>
                )}
              </section>
            ))
          ) : (
            <div className="text-slate-600 text-sm">Нет данных для отображения.</div>
          )}
        </div>
      </div>
    );
  };

  // ===== Рендер =====
  if (!structureCode) {
    return <div className="text-slate-500">Сначала выберите деталь.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a1 1 0 011 1v2a1 1 0 01-2 0V3a1 1 0 011-1Z" />
          <path d="M21 11a1 1 0 100 2h2a1 1 0 100-2h-2Z" />
        </svg>
        Загружаю шаги разборки/сборки…
      </div>
    );
  }

  if (err) {
    return <div className="text-red-600">Ошибка загрузки: {err}</div>;
  }

  if (!data) {
    return <div className="text-slate-600">Нет данных для этой детали.</div>;
  }

  // Если открыт встроенный режим «деталка» — показываем его вместо базового интерфейса
  if (inDetail && currentDetail) {
    return (
      <>
        {renderDetailView(currentDetail)}
        <Lightbox open={lbOpen} src={lbSrc} alt={lbAlt} onClose={() => setLbOpen(false)} />
        <ProcedurePopup
          open={procOpen}
          title={procTitle}
          data={procData}
          onClose={() => setProcOpen(false)}
          onImageClick={(url) => {
            setLbSrc(url);
            setLbAlt("");
            setLbOpen(true);
          }}
        />
      </>
    );
  }

  // ==== Базовый режим ====
  return (
    <div className="destuffing space-y-4 text-slate-900">
      {/* Верхние карточки (кликабельные) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Основная информация */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-3 hover:shadow cursor-pointer transition"
          onClick={() => setInfoDlg(true)}
          title="Открыть в окне"
        >
          <div className="text-sm font-semibold mb-2">Основная информация</div>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Наименование детали:</dt>
              <dd className="text-right text-slate-900">{info?.materialName || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Номер детали:</dt>
              <dd className="text-right text-slate-900">{info?.materialCode || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Идентификатор шагов:</dt>
              <dd className="text-right text-slate-900">{info?.destuffingCode || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Текущая версия:</dt>
              <dd className="text-right text-slate-900">{info?.edition ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Норма времени:</dt>
              <dd className="text-right text-slate-900">
                {info?.manHour || "—"}
                {typeof info?.hours === "number" ? ` (≈${info.hours} ч)` : ""}
              </dd>
            </div>
          </dl>
        </section>

        {/* Положение детали */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-3 hover:shadow cursor-pointer transition"
          onClick={() => (loc?.fileUrl ? setLocDlg(true) : null)}
          title={loc?.fileUrl ? "Открыть изображение" : undefined}
        >
          <div className="text-sm font-semibold mb-2">Положение детали</div>
          {loc?.fileUrl ? (
            <img
              src={loc.fileUrl}
              alt="Положение детали"
              className="block w-full h-auto rounded-lg border border-slate-200"
              style={{ cursor: "zoom-in" }}
            />
          ) : (
            <div className="text-slate-500 text-sm">Нет изображения.</div>
          )}
        </section>

        {/* Особые замечания */}
        <section
          className="rounded-xl border border-slate-200 bg-amber-50 p-3 hover:shadow cursor-pointer transition"
          onClick={() => (notes.length ? setNotesDlg(true) : null)}
          title={notes.length ? "Открыть в окне" : undefined}
        >
          <div className="text-sm font-semibold mb-2">Особые замечания</div>
          {notes.length ? (
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {notes.map((n, i) => (
                <li key={`${n.textCode || i}`}>
                  <div className="text-slate-800 whitespace-pre-line">{n.content || ""}</div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-slate-500 text-sm">Нет.</div>
          )}
        </section>

        {/* Предупреждение */}
        <section
          className="rounded-xl border border-slate-200 bg-rose-50 p-3 hover:shadow cursor-pointer transition"
          onClick={() => (warns.length ? setWarnsDlg(true) : null)}
          title={warns.length ? "Открыть в окне" : undefined}
        >
          <div className="text-sm font-semibold mb-2">Предупреждение</div>
          {warns.length ? (
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {warns.map((w, i) => (
                <li key={`${w.textCode || i}`}>
                  <div className="text-slate-800 whitespace-pre-line">{w.content || ""}</div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-slate-500 text-sm">Нет.</div>
          )}
        </section>
      </div>

      {/* Низ: табы + правая колонка */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Левая часть: табы со списком шагов */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          {/* Табы */}
          <div className="border-b border-slate-200 px-2">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((t, idx) => {
                const active = idx === activeTabIdx;
                return (
                  <button
                    key={t.stepTabCode || idx}
                    onClick={() => setActiveTabIdx(idx)}
                    className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
                      active
                        ? "border-indigo-600 text-indigo-700 font-semibold"
                        : "border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-200"
                    }`}
                    title={t.labelName || "Таб"}
                  >
                    {t.labelName || `Таб ${idx + 1}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Контент активного таба */}
          <div className="p-3">
            {!activeTab || activeTab.detailList.length === 0 ? (
              <div className="text-slate-600 text-sm">Нет шагов в этой секции.</div>
            ) : (
              <ol className="space-y-2">
                {activeTab.detailList.map((s, i) => (
                  <li key={s.stepCode || `${activeTabIdx}-${i}`}>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 text-[12px] text-slate-700 bg-slate-50">
                        {i + 1}
                      </span>
                      <div
                        className="prose prose-slate prose-sm safe-html max-w-none prose-a:text-indigo-700 hover:prose-a:underline prose-p:my-1"
                        dangerouslySetInnerHTML={{ __html: s.stepExplain || "" }}
                        onClick={onHtmlClick}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Правая колонка: Перечень одноразовых деталей (из /material_list) */}
        <aside className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Перечень деталей</div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Перечень одноразовых деталей
            </span>
          </div>

          {mlRows === null ? (
            <div className="text-slate-500 text-sm">Загружаю список…</div>
          ) : mlErr ? (
            <div className="text-red-600 text-sm">Ошибка: {mlErr}</div>
          ) : !mlRows?.length ? (
            <div className="text-slate-500 text-sm">Детали не найдены.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[420px] w-full text-sm border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-1 border-b">Наименование детали</th>
                    <th className="text-left px-2 py-1 border-b">Номер детали</th>
                    <th className="text-left px-2 py-1 border-b">Количество детали (ед. изм.)</th>
                  </tr>
                </thead>
                <tbody>
                  {mlRows.map((r, i) => (
                    <tr key={`${r.materialCode || i}`} className="odd:bg-white even:bg-slate-50">
                      <td className="px-2 py-1">{r.materialName || "—"}</td>
                      <td className="px-2 py-1">{r.materialCode || "—"}</td>
                      <td className="px-2 py-1">
                        {r.materialNum ?? "—"}{r.materialUnit ? ` (${r.materialUnit})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>

      {/* Диалоги карточек (базовый режим) */}
      <Dialog open={infoDlg} title="Основная информация" onClose={() => setInfoDlg(false)}>
        <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-slate-500">Наименование детали:</dt>
            <dd className="text-slate-900">{info?.materialName || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Номер детали:</dt>
            <dd className="text-slate-900">{info?.materialCode || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Идентификатор шагов разборки и сборки:</dt>
            <dd className="text-slate-900">{info?.destuffingId || info?.destuffingCode || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Текущая версия:</dt>
            <dd className="text-slate-900">{info?.edition ?? "—"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-slate-500">Норма времени:</dt>
            <dd className="text-slate-900">
              {info?.manHour || "—"}
              {typeof info?.hours === "number" ? ` (≈${info.hours} ч)` : ""}
            </dd>
          </div>
        </dl>
      </Dialog>

      <Dialog open={locDlg} title="Положение детали" onClose={() => setLocDlg(false)} widthClass="w-[min(1200px,calc(100vw-2rem))]">
        {loc?.fileUrl ? (
          <div className="flex justify-center">
            <img
              src={loc.fileUrl}
              alt="Положение детали"
              className="block max-w-full h-auto rounded-lg border border-slate-200"
              style={{ width: "90%" }}
            />
          </div>
        ) : (
          <div className="text-slate-600 text-sm">Нет изображения.</div>
        )}
      </Dialog>

      <Dialog open={notesDlg} title="Особые замечания" onClose={() => setNotesDlg(false)} widthClass="w-[min(900px,calc(100vw-2rem))]">
        {notes.length ? (
          <div className="bg-amber-50 rounded-lg p-4">
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              {notes.map((n, i) => (
                <li key={`${n.textCode || i}`}>
                  <div className="text-slate-900 whitespace-pre-line">{n.content || ""}</div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="text-slate-600 text-sm">Нет.</div>
        )}
      </Dialog>

      <Dialog open={warnsDlg} title="Предупреждение" onClose={() => setWarnsDlg(false)} widthClass="w-[min(900px,calc(100vw-2rem))]">
        {warns.length ? (
          <div className="bg-rose-50 rounded-lg p-4">
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              {warns.map((w, i) => (
                <li key={`${w.textCode || i}`}>
                  <div className="text-slate-900 whitespace-pre-line">{w.content || ""}</div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="text-slate-600 text-sm">Нет предупреждений.</div>
        )}
      </Dialog>

      {/* Лайтбокс и поп-ап процедур */}
      <Lightbox open={lbOpen} src={lbSrc} alt={lbAlt} onClose={() => setLbOpen(false)} />
      <ProcedurePopup
        open={procOpen}
        title={procTitle}
        data={procData}
        onClose={() => setProcOpen(false)}
        onImageClick={(url) => { setLbSrc(url); setLbAlt(""); setLbOpen(true); }}
      />
    </div>
  );
}

// src/pages/Viewer/Viewer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext.jsx";
import API from "../../api/dms.js";
import Topbar from "../../components/Topbar.jsx";
import Sidebar from "../../components/Sidebar.jsx";
import NodeHeader from "../../components/NodeHeader.jsx";
import NodeTabs from "../../components/NodeTabs.jsx";
import useTreeSortFilter from "../../hooks/useTreeSortFilter.js";
import { exportPartDoc } from "../../api/export.js";

import TreeView from "./components/TreeView.jsx";
import SvgPanel from "./components/SvgPanel.jsx";
import Lightbox from "./components/Lightbox.jsx";
import useSidebarResize from "./hooks/useSidebarResize.js";
import CircuitPanel from "./components/CircuitPanel.jsx";
import DestuffingTabs from "./components/DestuffingTabs.jsx";

import {
  formatCircuit,
  formatFunctionDesc,
  formatDestuffing,
  formatPartDetail,
  formatTechnical,
} from "./utils/htmlFormatters.js";
import { extractHeader, getExplosivePayload } from "./utils/dataExtractors.js";
import setsEqual from "./utils/setsEqual.js";

export default function Viewer() {
  const { logout, isAdmin } = useAuth();

  // модели
  const [models, setModels] = useState([]);
  const [currentSub, setCurrentSub] = useState("");

  // дерево
  const [childrenResp, setChildrenResp] = useState(null);
  const [rootKey, setRootKey] = useState("");
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState("default");
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  // выбор узла + «шапка»
  const [selected, setSelected] = useState(null);
  const [head, setHead] = useState(null);

  // доступность вкладок (из structure_get)
  const [avail, setAvail] = useState({
    img: true,
    fdesc: false,
    tech: false,
    circuit: false,
    steps: false,
  });

  // правая панель
  const [infoHtml, setInfoHtml] = useState(
    <div className="text-slate-500">(выберите модель)</div>
  );
  const [imageHtml, setImageHtml] = useState(null);

  // экспорт
  const [exporting, setExporting] = useState(false);

  // кэш схем (payload: {url, svgContent, hotspotToStructures, hotspotHighlight, resourceName})
  const [imageCache, setImageCache] = useState({});
  const imageBlockRef = useRef(null);

  // интерактив по картинкам в правой HTML-панели (лайтбокс)
  const contentRef = useRef(null);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbSrc, setLbSrc] = useState("");
  const [lbAlt, setLbAlt] = useState("");

  // ресайз сайдбара
  const { mainRef, sidebarWidth, isResizing, onResizeStart, onResizeReset } =
    useSidebarResize({ initial: 340, min: 240, max: 560 });

  // сорт/фильтр/карта
  const { structureMap, getSectionDeep, autoExpandedKeys, computeRootKey } =
    useTreeSortFilter({ childrenResp, q, sortMode });

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    const js = await API.models();
    setModels(
      (Array.isArray(js?.data) ? js.data : Array.isArray(js?.data?.data) ? js.data.data : []).map(
        (row) => ({
          value: String(row.subSeries ?? ""),
          label: `${row.series ?? ""}-${row.subSeries ?? ""} (${row.subSeriesDesc ?? ""})`,
          series: String(row.series ?? ""),
          subSeries: String(row.subSeries ?? ""),
          subSeriesDesc: String(row.subSeriesDesc ?? ""),
        })
      )
    );
    resetTreeState("(выберите модель и нажмите «Поиск»)");
  }

  function resetTreeState(msg) {
    setChildrenResp(null);
    setRootKey("");
    setExpandedKeys(new Set());
    setSelected(null);
    setHead(null);
    setInfoHtml(<div className="text-slate-500">{msg}</div>);
    setImageHtml(null);
    setImageCache({});
    setAvail({ img: true, fdesc: false, tech: false, circuit: false, steps: false });
  }

  function onModelChange(sub) {
    setCurrentSub(sub);
    resetTreeState(sub ? "(нажмите «Поиск»)" : "(выберите модель)");
  }

  async function searchChildren() {
    if (!currentSub) {
      alert("Сначала выберите модель");
      return;
    }
    setSelected(null);
    setHead(null);
    setInfoHtml(<div className="text-slate-500">(загрузка…)</div>);
    setImageHtml(null);

    const js = await API.children(currentSub, "");
    setChildrenResp(js);
  }

  // вычисляем корень
  useEffect(() => {
    const map =
      childrenResp?.data?.structureMap ||
      childrenResp?.data?.data?.structureMap ||
      null;

    if (!map || !Object.keys(map || {}).length) {
      if (childrenResp) resetTreeState("(узлы не найдены)");
      return;
    }
    const rk = computeRootKey(currentSub);
    setRootKey(rk || "");
    setExpandedKeys(new Set());
    setInfoHtml(<div className="text-slate-500">(выберите деталь слева)</div>);
    setImageHtml(null);
  }, [childrenResp, currentSub, computeRootKey]);

  // авто-раскрытие по поиску
  useEffect(() => {
    if (!rootKey) return;
    const needle = (q || "").trim();
    if (!needle) {
      setExpandedKeys((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const next = autoExpandedKeys(rootKey, needle);
    setExpandedKeys((prev) => (setsEqual(prev, next) ? prev : next));
  }, [q, rootKey, structureMap, autoExpandedKeys]);

  function toggleExpand(item) {
    const key = String(item?.structureCode || "");
    if (!key) return;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** =======================
   *  Индекс по дереву (code → item, parentKey) + путь предков
   *  ======================= */
  const flatIndex = useMemo(() => {
    const idx = {};
    for (const [parentKey, arr] of Object.entries(structureMap || {})) {
      (arr || []).forEach((it) => {
        if (!idx[it.structureCode]) {
          idx[it.structureCode] = { item: it, parentKey };
        }
      });
    }
    return idx;
  }, [structureMap]);

  function getAncestorCodes(code) {
    const out = [];
    let cur = flatIndex[code]?.item;
    while (cur?.parentStructureCode) {
      const p = cur.parentStructureCode;
      if (Array.isArray(structureMap[p]) && structureMap[p].length > 0) {
        out.push(p);
      }
      cur = flatIndex[p]?.item;
    }
    return out.reverse();
  }

  // выбрать лучший код из списка хотспота
  function pickHotspotTarget(hotspotId, map) {
    const arr = (map?.[hotspotId] || []).map(String);
    if (!arr.length) return "";
    const inTreeNotSelf = arr.find(
      (c) => c !== selected?.item?.structureCode && !!flatIndex[c]
    );
    if (inTreeNotSelf) return inTreeNotSelf;
    const inTree = arr.find((c) => !!flatIndex[c]);
    if (inTree) return inTree;
    const notSelf = arr.find((c) => c !== selected?.item?.structureCode);
    if (notSelf) return notSelf;
    return arr[0];
  }

  // быстрый переход по коду узла (клик из хотспота)
  async function openByCode(structureCode) {
    if (!structureCode) return;

    const hit = flatIndex[structureCode];

    // если уже выбран — просто раскрыть путь и проскроллить
    if (selected?.item?.structureCode === structureCode) {
      const needExpand = getAncestorCodes(structureCode);
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        needExpand.forEach((k) => next.add(k));
        return next;
      });
      requestAnimationFrame(() => {
        const el = document.querySelector(
          `[data-structure-code="${CSS.escape(structureCode)}"]`
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    if (hit?.item) {
      // 1) раскрыть предков
      const needExpand = getAncestorCodes(structureCode);
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        needExpand.forEach((k) => next.add(k));
        return next;
      });

      // 2) открыть реальный item из дерева (корректный itemId)
      await onOpenNode(hit.item, hit.parentKey);

      // 3) проскроллить к нему
      requestAnimationFrame(() => {
        const el = document.querySelector(
          `[data-structure-code="${CSS.escape(structureCode)}"]`
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    // Фолбэк: кода нет в текущем дереве
    try {
      const struct = await API.structureGet(structureCode).catch(() => null);
      const d = struct?.data?.data ?? {};
      const fakeItem = {
        structureCode,
        structureName: d.materialName || d.structureName || "",
        materialName: d.materialName || "",
        materialCode: d.materialCode || "",
        manHour: d.manHour || "",
      };
      await onOpenNode(fakeItem, "");
    } catch (e) {
      setInfoHtml(
        <div className="text-red-600">Не удалось открыть узел: {String(e?.message || e)}</div>
      );
    }
  }

  // Открытие узла
  async function onOpenNode(it, parentKey) {
    setSelected({ item: it, parentLabel: parentKey || "" });
    setHead(null);
    setInfoHtml(<div className="text-slate-500">(загрузка…)</div>);
    setImageHtml(<div className="text-slate-500">(загрузка изображения/схемы…)</div>);

    const code = it.structureCode;

    // 1) шапка
    const struct = await API.structureGet(code);
    setHead(extractHeader(struct, it));

    // 2) флаги доступности
    const sd = struct?.data?.data ?? struct?.data ?? {};
    setAvail({
      img: true,
      fdesc: !!sd.functionDescId,
      tech: sd.technicalDataStatus === 1,
      circuit: sd.circuitStatus === 1,
      steps: sd.destuffingStatus === 1,
    });

    // 3) схема/картинка
    const cachedPayload = imageCache[code];
    if (cachedPayload !== undefined) {
      setImageHtml(
        cachedPayload ? (
          <SvgPanel
            refEl={imageBlockRef}
            url={cachedPayload.url}
            svgContent={cachedPayload.svgContent}
            hotspotHighlight={cachedPayload.hotspotHighlight}
            hotspotToStructures={cachedPayload.hotspotToStructures}
            title={cachedPayload.resourceName}
            onHotspotClick={(hotspotId) => {
              const target = pickHotspotTarget(
                hotspotId,
                cachedPayload.hotspotToStructures
              );
              if (target) openByCode(target);
            }}
          />
        ) : (
          <div className="text-slate-500">(нет изображения)</div>
        )
      );
    } else {
      try {
        const expl = await API.explosive(code).catch(() => null);
        const payload = getExplosivePayload(expl || {});
        setImageCache((prev) => ({ ...prev, [code]: payload || null }));
        setImageHtml(
          payload ? (
            <SvgPanel
              refEl={imageBlockRef}
              url={payload.url}
              svgContent={payload.svgContent}
              hotspotHighlight={payload.hotspotHighlight}
              hotspotToStructures={payload.hotspotToStructures}
              title={payload.resourceName}
              onHotspotClick={(hotspotId) => {
                const target = pickHotspotTarget(
                  hotspotId,
                  payload.hotspotToStructures
                );
                if (target) openByCode(target);
              }}
            />
          ) : (
            <div className="text-slate-500">(нет изображения)</div>
          )
        );
      } catch (e) {
        setImageHtml(
          <div className="text-red-600">Ошибка загрузки изображения: {String(e?.message || e)}</div>
        );
      }
    }

    setInfoHtml(
      <div className="text-slate-500">Выберите вкладку выше, чтобы увидеть данные.</div>
    );
  }

  const selectedModelLabel = useMemo(() => {
    const m = models.find((x) => x.value === currentSub);
    return m ? m.label : "";
  }, [models, currentSub]);

  function sanitizeFilename(s = "") {
    return s.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);
  }

  // Показ секций / экспорт
  async function handleShow(code, tab) {
    if (!code) {
      setInfoHtml(<div className="text-red-600">Сначала выберите деталь.</div>);
      return;
    }

    if (tab === "img") {
      imageBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setInfoHtml(<div className="text-slate-500">Прокрутил к изображению ниже.</div>);
      return;
    }

    // Интерактивная электрическая схема
    if (tab === "circuit") {
      setInfoHtml(<CircuitPanel structureCode={code} />);
      return;
    }

    // НОВОЕ: табы «Шаги разборки и сборки»
    if (tab === "steps") {
      setInfoHtml(<DestuffingTabs structureCode={code} />);
      return;
    }

    if (tab === "export") {
      setExporting(true);
      setInfoHtml(
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a1 1 0 011 1v2a1 1 0 01-2 0V3a1 1 0 011-1Z" />
            <path d="M21 11a1 1 0 100 2h2a1 1 0 100-2h-2Z" />
          </svg>
          Формирую документ… собираю данные детали
        </div>
      );

      try {
        const [struct, tech, steps, part, circuit, fdesc, imgUrl] = await Promise.all([
          API.structureGet(code).catch(() => null),
          API.technical(code).catch(() => null),
          API.destuffing(code).catch(() => null),
          API.partDetail(code).catch(() => null),
          API.circuit(code).catch(() => null),
          API.functionDesc(code).catch(() => null),
          (async () => {
            const e = await API.explosive(code).catch(() => null);
            const p = getExplosivePayload(e || {});
            return p?.url || "";
          })(),
        ]);

        const header = extractHeader(struct || {}, selected?.item || {});
        const payload = {
          code,
          model: { subSeries: currentSub || "", label: selectedModelLabel || "" },
          header,
          imageUrl: imgUrl || "",
          sections: {
            functionDesc: fdesc ? formatFunctionDesc(fdesc) : "",
            technical: tech ? formatTechnical(tech) : "",
            steps: steps ? formatDestuffing(steps) : "",
            part: part ? formatPartDetail(part) : "",
            circuit: circuit ? formatCircuit(circuit) : "",
          },
        };

        const blob = await exportPartDoc(payload);
        const fnameBase =
          sanitizeFilename(`${header.materialCode || code} ${header.name || ""}`.trim()) ||
          `detail-${code}`;
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const filename = `${fnameBase}__${stamp}.docx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setInfoHtml(
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 px-3 py-2">
            Документ сформирован и скачан: <span className="font-medium">{filename}</span>
          </div>
        );
      } catch (e) {
        setInfoHtml(
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-3 py-2">
            Ошибка формирования документа: {String(e?.message || e)}
          </div>
        );
      } finally {
        setExporting(false);
      }
      return;
    }

    // Показ текстовых секций
    setInfoHtml(<div className="text-slate-500">(загрузка…)</div>);
    try {
      let resp, html = "";
      if (tab === "fdesc") {
        resp = await API.functionDesc(code);
        html = formatFunctionDesc(resp);
      } else if (tab === "tech") {
        resp = await API.technical(code);
        html = formatTechnical(resp);
      } else if (tab === "part") {
        resp = await API.partDetail(code);
        html = formatPartDetail(resp);
      }

      setInfoHtml(
        <div
          className="border border-slate-200 dark:border-slate-700 rounded-xl p-3
                     prose prose-sm dark:prose-invert max-w-none
                     [&_*]:!bg-transparent [&_*]:bg-transparent/0
                     [&_*]:shadow-none
                     [&_img]:max-w-full [&_img]:h-auto
                     [&_table]:w-full"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch (e) {
      setInfoHtml(<div className="text-red-600">Ошибка загрузки данных: {String(e?.message || e)}</div>);
    }
  }

  // Лайтбокс: клики по изображениям в infoHtml
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onClick = (e) => {
      const img = e.target.closest("img");
      if (!img) return;
      const src = img.getAttribute("src") || "";
      if (!src) return;
      e.preventDefault();
      setLbSrc(src);
      setLbAlt(img.getAttribute("alt") || "");
      setLbOpen(true);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [infoHtml]);

  return (
    <div className="flex min-h-[100vh]">
      <div className="flex-1 flex flex-col">
        <Topbar
          modelOptions={models}
          value={currentSub}
          onChange={onModelChange}
          onSearch={searchChildren}
          onLogout={logout}
        />

        <main
          ref={mainRef}
          className={`flex h-[calc(100vh-56px)] ${isResizing ? "select-none cursor-col-resize" : ""}`}
        >
          <Sidebar
            width={sidebarWidth}
            q={q}
            setQ={setQ}
            sortMode={sortMode}
            setSortMode={setSortMode}
            treeEl={
              <TreeView
                structureMap={structureMap}
                rootKey={rootKey}
                q={q}
                expandedKeys={expandedKeys}
                getSectionDeep={getSectionDeep}
                onToggleExpand={toggleExpand}
                onOpenNode={onOpenNode}
                selected={selected}
              />
            }
          />

          <div
            onMouseDown={onResizeStart}
            onDoubleClick={onResizeReset}
            title="Потяните, чтобы изменить ширину (двойной клик — сбросить)"
            className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-slate-300/40 dark:hover:bg-slate-700/50 transition-colors"
          />

          <div className="flex-1 min-w-0 p-3 space-y-3 overflow-auto custom-scroll">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center text-xs px-2 py-1 rounded-full
                           bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-slate-200
                           border border-indigo-100 dark:border-slate-700"
              >
                Админка
              </Link>
            )}

            {head && <NodeHeader head={head} />}

            {selected && (
              <div className="flex items-center gap-2">
                <NodeTabs
                  code={selected.item.structureCode}
                  onShow={handleShow}
                  available={avail}
                />
                {exporting && (
                  <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10" opacity=".2" />
                      <path d="M12 2a10 10 0 0 1 10 10h-2A8 8 0 0 0 12 4V2z" />
                    </svg>
                    Генерация…
                  </span>
                )}
              </div>
            )}

            <div ref={contentRef}>{infoHtml}</div>
            {imageHtml}
          </div>
        </main>
      </div>

      <Lightbox open={lbOpen} src={lbSrc} alt={lbAlt} onClose={() => setLbOpen(false)} />
    </div>
  );
}

// src/pages/Viewer/components/CircuitPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../../../api/dms.js";
import Lightbox from "./Lightbox.jsx";
import CircuitPopup from "./CircuitPopup.jsx";
import useSvgHotspots from "../../../hooks/useSvgHotspots.js";


function useInlineSvg(url) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let dead = false;
    (async () => {
      setError(""); setHtml("");
      if (!url) return;
      try {
        const r = await fetch(url, { mode: "cors" });
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        const txt = await r.text();
        if (!r.ok) throw new Error(`${r.status} ${r.statusText || "HTTP error"}`);

        const looksLikeSvg = /\<svg[\s>]/i.test(txt);
        const headerOk = ct.includes("svg");
        if (!headerOk && !looksLikeSvg) {
          throw new Error(`Unexpected content-type: ${ct || "unknown"}`);
        }
        if (!dead) setHtml(txt);
      } catch (e) {
        if (!dead) { setError(e?.message || String(e)); setHtml(""); }
      }
    })();
    return () => { dead = true; };
  }, [url]);
  return { html, error };
}

function normalizeSvg(svgEl, mount) {
  svgEl.style.display = "block";
  svgEl.style.width = "100%";
  svgEl.style.height = "auto";
  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");
  if (!svgEl.getAttribute("preserveAspectRatio")) {
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  let vb = null;
  const vbAttr = svgEl.getAttribute("viewBox");
  if (vbAttr) {
    const [x, y, w, h] = vbAttr.split(/\s+|,/).map(Number);
    if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) vb = { x, y, w, h };
  }

  try {
    mount.appendChild(svgEl);
    const b = svgEl.getBBox();
    const bbox = { x: b.x, y: b.y, w: Math.max(1, b.width), h: Math.max(1, b.height) };

    if (vb) {
      const areaVB = vb.w * vb.h;
      const areaBB = bbox.w * bbox.h;
      if (areaBB > areaVB * 1.05) {
        const px = bbox.w * 0.01, py = bbox.h * 0.01;
        svgEl.setAttribute("viewBox", `${Math.floor(bbox.x - px)} ${Math.floor(bbox.y - py)} ${Math.ceil(bbox.w + 2*px)} ${Math.ceil(bbox.h + 2*py)}`);
      }
    } else {
      const px = bbox.w * 0.01, py = bbox.h * 0.01;
      svgEl.setAttribute("viewBox", `${Math.floor(bbox.x - px)} ${Math.floor(bbox.y - py)} ${Math.ceil(bbox.w + 2*px)} ${Math.ceil(bbox.h + 2*py)}`);
    }

    svgEl.remove();
  } catch {}
  return svgEl;
}

function expandUseElements(svg) {
  const XLINK = "http://www.w3.org/1999/xlink";
  const uses = Array.from(svg.querySelectorAll("use"));
  for (const u of uses) {
    const href = u.getAttribute("href") || u.getAttributeNS(XLINK, "href");
    if (!href || !href.startsWith("#")) continue;
    const ref = svg.querySelector(href);
    if (!ref) continue;

    const clone = ref.cloneNode(true);
    const gx = parseFloat(u.getAttribute("x") || "0") || 0;
    const gy = parseFloat(u.getAttribute("y") || "0") || 0;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (gx || gy) g.setAttribute("transform", `translate(${gx} ${gy})`);

    for (const a of Array.from(u.attributes)) {
      const n = a.name;
      if (n === "x" || n === "y" || n === "href" || n === "xlink:href") continue;
      g.setAttribute(n, a.value);
    }
    g.appendChild(clone);
    u.replaceWith(g);
  }
}

const STYLE_ONCE = `
.__circuit-host { background:#fff!important; user-select:none; }
text { pointer-events:auto !important; } /* на случай pointer-events:none в исходнике */
.__c-hotspot, .__c-hotspot * { cursor:pointer !important; }
.__c-hotspot { outline:none; }
text.__c-hotspot:hover { filter: drop-shadow(0 0 .5px rgba(0,0,0,.15)) brightness(1.06); }
.__c-type-10 { paint-order: stroke fill; stroke:#6366f1 !important; stroke-width:1.2 !important; }
.__c-type-20 { paint-order: stroke fill; stroke:#16a34a !important; stroke-width:1.2 !important; }
.__c-type-30 { paint-order: stroke fill; stroke:#0ea5e9 !important; stroke-width:1.2 !important; }
svg { display:block; text-rendering:optimizeLegibility; shape-rendering:geometricPrecision; }

/* Кнопки внутри холста, внизу справа */
.c-toolbar{position:absolute;right:.5rem;bottom:.5rem;z-index:3;display:flex;gap:.25rem}
.c-btn{font-size:12px;padding:.25rem .5rem;border:1px solid #cbd5e1;border-radius:.375rem;background:#fff;color:#0f172a}
.c-btn:hover{background:#f8fafc}
.c-grab{cursor:grab}
.c-grabbing{cursor:grabbing}

/* Короткая подсветка выбранного текста */
@keyframes __c-flash { 0%{fill:#fde68a} 100%{fill:inherit} }
.__c-flash { animation: __c-flash 1.2s ease-out 1; }
`;


function KindBadge({ t }) {
  const map = {
    10: { name: "Объект", cls: "border-indigo-300 text-indigo-700 bg-indigo-50" },
    20: { name: "Разъём", cls: "border-emerald-300 text-emerald-700 bg-emerald-50" },
    30: { name: "Ссылка", cls: "border-sky-300 text-sky-700 bg-sky-50" },
  };
  const k = map[t] || map[10];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded-md border ${k.cls}`}>{k.name}</span>;
}

export default function CircuitPanel({ structureCode }) {
  const styleInjectedRef = useRef(false);
  const [list, setList] = useState([]);
  const [curIdx, setCurIdx] = useState(0);
  const cur = list[curIdx] || null;

  const [hotspots, setHotspots] = useState([]);
  const [error, setError] = useState("");
  const [openZoom, setOpenZoom] = useState(false);

  const [detail, setDetail] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState(null);

  const hostRef = useRef(null);
  const svgMountRef = useRef(null);
  const svgRootRef = useRef(null);

  const vbInitRef = useRef({ x: 0, y: 0, w: 1000, h: 700 });
  const [vb, setVb] = useState({ x: 0, y: 0, w: 1000, h: 700 });
  const vbRef = useRef(vb);
  useEffect(() => { vbRef.current = vb; }, [vb]);

  const dragRef = useRef(null);

  useEffect(() => {
    if (styleInjectedRef.current) return;
    const id = "circuit-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.innerHTML = STYLE_ONCE;
      document.head.appendChild(style);
    }
    styleInjectedRef.current = true;
  }, []);

  useEffect(() => {
    let dead = false;
    setList([]); setCurIdx(0); setHotspots([]); setDetail(null);
    setPopupOpen(false); setActiveHotspot(null);
    (async () => {
      try {
        const js = await API.circuit(structureCode);
        const arr = js?.data?.structureCircuitList || js?.data?.data?.structureCircuitList || [];
        if (!dead) setList(arr);
      } catch (e) {
        if (!dead) setError(e?.message || String(e));
      }
    })();
    return () => { dead = true; };
  }, [structureCode]);

  const fileUrl = cur?.fileUrl || "";
  const circuitId = cur?.circuitResourceCode || "";
  const { html, error: svgErr } = useInlineSvg(fileUrl);

  useEffect(() => {
    setDetail(null);
    setPopupOpen(false);
    setActiveHotspot(null);
    setHotspots([]);
  }, [curIdx]);

  useEffect(() => {
    let dead = false;
    if (!circuitId) { setHotspots([]); return; }
    (async () => {
      try {
        const js = await API.circuitHot(circuitId);
        const arr = Array.isArray(js?.data) ? js.data : Array.isArray(js?.data?.data) ? js.data.data : [];
        if (!dead) setHotspots(arr);
      } catch { if (!dead) setHotspots([]); }
    })();
    return () => { dead = true; };
  }, [circuitId]);

  useEffect(() => {
    const mount = svgMountRef.current;
    if (!mount) return;
    mount.innerHTML = "";
    svgRootRef.current = null;

    if (!html) return;

    let root, vbX=0, vbY=0, vbW=0, vbH=0;
    try {
      const doc = new DOMParser().parseFromString(html, "image/svg+xml");
      const parsedSvg = doc.documentElement;
      const svgEl = document.importNode(parsedSvg, true);
      const normalized = normalizeSvg(svgEl, mount);

      expandUseElements(normalized);

      mount.appendChild(normalized);
      root = normalized;
      const vbBase = normalized.viewBox?.baseVal;
      if (vbBase && vbBase.width && vbBase.height) {
        vbX = vbBase.x; vbY = vbBase.y; vbW = vbBase.width; vbH = vbBase.height;
      }
    } catch {
      mount.innerHTML = html;
      root = mount.querySelector("svg") || mount;
    }

    if (root) {
      try {
        if ((!vbW || !vbH) && root.getBBox) {
          const bb = root.getBBox();
          vbX = bb.x; vbY = bb.y; vbW = bb.width || 1000; vbH = bb.height || 700;
        }
      } catch {}
      vbW = Math.max(1, vbW || 1000);
      vbH = Math.max(1, vbH || 700);
      vbInitRef.current = { x: vbX, y: vbY, w: vbW, h: vbH };
      setVb({ x: vbX, y: vbY, w: vbW, h: vbH });
    }
    svgRootRef.current = root;
  }, [html]);

  const { findNode, stats: hotspotStats } = useSvgHotspots({
    svgRootRef,
    hotspots,
    onHotspot: (h, el) => openHotspot(h, el),
    typeClassMap: { 10: "__c-type-10", 20: "__c-type-20", 30: "__c-type-30" },
  });

  useEffect(() => {
    const root = svgRootRef.current;
    if (!root) return;
    root.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }, [vb]);

  function clampVB(next) {
    const init = vbInitRef.current;
    const maxX = init.x + init.w - next.w;
    const maxY = init.y + init.h - next.h;
    const minFrac = 0.02;
    const minW = init.w * minFrac;
    const minH = init.h * minFrac;
    return {
      x: Math.min(Math.max(next.x, init.x), Math.max(init.x, maxX)),
      y: Math.min(Math.max(next.y, init.y), Math.max(init.y, maxY)),
      w: Math.min(Math.max(next.w, minW), init.w),
      h: Math.min(Math.max(next.h, minH), init.h),
    };
  }

  function zoomAroundClient(clientX, clientY, factor) {
    const svg = svgRootRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cur = vbRef.current;
    const unitX = cur.w / rect.width;
    const unitY = cur.h / rect.height;
    const wx = cur.x + (clientX - rect.left) * unitX;
    const wy = cur.y + (clientY - rect.top) * unitY;

    let nw = cur.w / factor;
    let nh = cur.h / factor;
    nw = Math.min(Math.max(nw, vbInitRef.current.w * 0.02), vbInitRef.current.w);
    nh = Math.min(Math.max(nh, vbInitRef.current.h * 0.02), vbInitRef.current.h);

    const nx = wx - (wx - cur.x) / factor;
    const ny = wy - (wy - cur.y) / factor;
    setVb(clampVB({ x: nx, y: ny, w: nw, h: nh }));
  }

  function zoomToBBox(bbox, paddingRatio = 0.1) {
    if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) return;
    const init = vbInitRef.current;
    let x = bbox.x, y = bbox.y, w = Math.max(1, bbox.width), h = Math.max(1, bbox.height);
    const px = w * paddingRatio;
    const py = h * paddingRatio;
    x = x - px; y = y - py; w = w + 2*px; h = h + 2*py;
    x = Math.max(init.x, Math.min(x, init.x + init.w - w));
    y = Math.max(init.y, Math.min(y, init.y + init.h - h));
    w = Math.min(w, init.w);
    h = Math.min(h, init.h);
    setVb(clampVB({ x, y, w, h }));
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      zoomAroundClient(e.clientX, e.clientY, factor);
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, []);

  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest(".__c-hotspot")) return;

    const svg = svgRootRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cur = vbRef.current;
    const unitX = cur.w / rect.width;
    const unitY = cur.h / rect.height;
    dragRef.current = { sx: e.clientX, sy: e.clientY, x0: cur.x, y0: cur.y, unitX, unitY };
    hostRef.current?.classList.add("c-grabbing");
    hostRef.current?.classList.remove("c-grab");
    e.preventDefault();
  }
  function onMouseMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) * d.unitX;
    const dy = (e.clientY - d.sy) * d.unitY;
    setVb((cur) => clampVB({ ...cur, x: d.x0 - dx, y: d.y0 - dy }));
  }
  function onMouseUp() {
    dragRef.current = null;
    hostRef.current?.classList.add("c-grab");
    hostRef.current?.classList.remove("c-grabbing");
  }
  function onDblClick(e) {
    zoomAroundClient(e.clientX, e.clientY, 1.5);
  }
  function resetToInitial() {
    const init = vbInitRef.current;
    setVb({ ...init });
  }

  useEffect(() => { hostRef.current?.focus(); }, [html]);

  async function openHotspot(h, elFromSvg) {
    try {
      const el = elFromSvg || findNode(h);

      if (el) {
        el.classList.remove("__c-flash");
        try { el.getBBox?.(); } catch {}
        el.classList.add("__c-flash");

      }

      const payload = {
        structureCode,
        circuitResourceCode: cur?.circuitResourceCode || "",
        hotspotCode: String(h.hotspotNum || h.hotspotName || "").trim() || undefined,
        wirResourceCode: null,
        wirHotspotCode: null,
      };
      const resp = await API.circuitClick(payload);
      setDetail(resp?.data || resp);
      setActiveHotspot(h);
      setPopupOpen(true);
    } catch (e) {
      setDetail({ __error: e?.message || String(e) });
      setActiveHotspot(h);
      setPopupOpen(true);
    }
  }

  const hotspotsSorted = useMemo(() => {
    const name = (h) => String(h.hotspotNum || h.hotspotName || "").trim();
    return [...hotspots].sort((a,b) => name(a).localeCompare(name(b), "ru"));
  }, [hotspots]);

  const tip = useMemo(() => {
    const n10 = hotspots.filter(h => h.hotspotType === 10).length;
    const n20 = hotspots.filter(h => h.hotspotType === 20).length;
    const n30 = hotspots.filter(h => h.hotspotType === 30).length;
    const total = hotspots.length;
    const base = total ? `Хотспотов: ${total} (объекты: ${n10}, разъёмы: ${n20}, ссылки: ${n30})` : "";
    const bound = hotspotStats?.total ? ` • привязано: ${hotspotStats.matched}/${hotspotStats.total}` : "";
    return base + bound;
  }, [hotspots, hotspotStats]);

  return (
    <section className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden relative">
      <div className="px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span>{cur?.circuitResourceName || "Электрическая схема"}</span>
          {!!list.length && (
            <select
              className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700"
              value={String(curIdx)}
              onChange={(e) => setCurIdx(Number(e.target.value))}
              title="Выбрать схему"
            >
              {list.map((it, i) => (
                <option key={it.circuitResourceCode} value={i}>
                  {it.circuitResourceName}
                </option>
              ))}
            </select>
          )}
          {!!hotspots.length && (
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <KindBadge t={10}/> <KindBadge t={20}/> <KindBadge t={30}/>
            </div>
          )}
        </div>

        <div className="flex items中心 gap-1">
          <label className="text-xs text-slate-500">Выбрать на схеме:</label>
          <select
            className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 max-w-[260px]"
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (Number.isFinite(idx) && hotspotsSorted[idx]) openHotspot(hotspotsSorted[idx]);
              e.target.selectedIndex = 0;
            }}
          >
            <option>(выбрать)</option>
            {hotspotsSorted.map((h, i) => {
              const label = String(h.hotspotNum || h.hotspotName || "").trim() || `#${i+1}`;
              const prefix = h.hotspotType === 20 ? "Разъём: " : h.hotspotType === 30 ? "Ссылка: " : "Объект: ";
              return <option key={`${label}-${i}`} value={i}>{prefix}{label}</option>;
            })}
          </select>
        </div>
      </div>

      {svgErr ? (
        <div className="p-3 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-200">
          Не удалось загрузить SVG ({svgErr})
        </div>
      ) : html ? (
        <div
          ref={hostRef}
          tabIndex={0}
          className="__circuit-host relative overflow-auto outline-none c-grab"
          style={{ maxHeight: "70vh" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDblClick}
          title={tip}
        >
          <div ref={svgMountRef} className="block w-full" />

          <div className="c-toolbar">
            <button
              className="c-btn"
              onClick={() => {
                const r = svgRootRef.current?.getBoundingClientRect();
                if (!r) return;
                zoomAroundClient(r.left + r.width / 2, r.top + r.height / 2, 1.2);
              }}
            >＋</button>
            <button
              className="c-btn"
              onClick={() => {
                const r = svgRootRef.current?.getBoundingClientRect();
                if (!r) return;
                zoomAroundClient(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
              }}
            >－</button>
            <button className="c-btn" onClick={resetToInitial}>По размеру</button>
          </div>
        </div>
      ) : (
        <div className="p-3 text-slate-500">(загрузка схемы…)</div>
      )}

      <CircuitPopup
        open={popupOpen}
        hotspot={activeHotspot}
        detail={detail}
        onClose={() => setPopupOpen(false)}
        onImageClick={(url) => setOpenZoom(url)}
      />

      {openZoom && (
        <Lightbox
          open={!!openZoom}
          src={typeof openZoom === "string" ? openZoom : fileUrl}
          alt={cur?.circuitResourceName || "circuit"}
          onClose={() => setOpenZoom(false)}
        />
      )}
    </section>
  );
}

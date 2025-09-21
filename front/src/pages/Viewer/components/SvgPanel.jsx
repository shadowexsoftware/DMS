// src/pages/Viewer/components/SvgPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "./Lightbox.jsx";

function useInlineSvg({ url, svgContent }) {
  const [html, setHtml] = useState(svgContent || "");
  const [error, setError] = useState("");

  useEffect(() => {
    let aborted = false;
    async function run() {
      setError("");
      if (svgContent) { setHtml(svgContent); return; }
      if (!url) { setHtml(""); return; }
      try {
        const resp = await fetch(url, { mode: "cors" });
        const ct = resp.headers.get("content-type") || "";
        if (!resp.ok || (!ct.includes("image/svg") && !ct.includes("svg"))) {
          throw new Error(`Unexpected content-type: ${ct || "unknown"}`);
        }
        const text = await resp.text();
        if (!aborted) setHtml(text);
      } catch (e) {
        if (!aborted) { setError(e?.message || String(e)); setHtml(""); }
      }
    }
    run();
    return () => { aborted = true; };
  }, [url, svgContent]);

  return { html, error };
}

function attachHotspotHandlers(root, { hotspotIds, highlightIds = [], onClick }) {
  if (!root) return { cleanup: () => {} };
  const toCleanup = [];

  const makeSelector = (id) => [
    `[data-hotspot="${id}"]`,
    `[data-id="${id}"]`,
    `[id="${id}"]`,
    `[id$="-${id}"]`,
    `[data-hot-spot="${id}"]`,
  ].join(",");

  const markAsHotspot = (el, isHighlighted) => {
    el.classList.add("__hotspot");
    if (isHighlighted) el.classList.add("__hotspot--active");
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");

    const onEnter = () => el.classList.add("__hotspot--hover");
    const onLeave = () => el.classList.remove("__hotspot--hover");
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); }
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("keydown", onKey);

    toCleanup.push(() => {
      el.classList.remove("__hotspot", "__hotspot--active", "__hotspot--hover");
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("keydown", onKey);
      el.removeAttribute("tabindex");
      el.removeAttribute("role");
    });
  };

  hotspotIds.forEach((id) => {
    const selector = makeSelector(id);
    const nodes = root.querySelectorAll(selector);

    const bag = [];
    if (nodes.length === 0) {
      root.querySelectorAll("text").forEach((t) => {
        if ((t.textContent || "").trim() === String(id)) bag.push(t);
      });
    } else {
      nodes.forEach((n) => bag.push(n));
    }

    const isHighlighted = highlightIds.includes(String(id));

    bag.forEach((el) => {
      const target = el;

      if (!target.__hotspotBoundIds) target.__hotspotBoundIds = new Set();
      if (!target.__hotspotBoundIds.has(String(id))) {
        const handler = (e) => { e.stopPropagation(); onClick?.(String(id)); };
        target.addEventListener("click", handler);
        toCleanup.push(() => target.removeEventListener("click", handler));
        target.__hotspotBoundIds.add(String(id));
      }

      markAsHotspot(target, isHighlighted);
    });
  });

  return { cleanup: () => toCleanup.forEach((fn) => fn()) };
}

const styleOnce = `
/* подсветка хотспотов внутри инлайн-SVG */
.__hotspot, .__hotspot * { cursor: pointer !important; }
.__hotspot { outline: none; }
.__hotspot--hover { filter: drop-shadow(0 0 0.6px rgba(0,0,0,.15)) brightness(1.05); }
.__hotspot--active, .__hotspot--active * {
  stroke: #6366f1 !important; /* indigo-500 */
  stroke-width: 1.6 !important;
  paint-order: stroke fill markers;
}
/* базовая вёрстка svg, чтобы не схлопывался */
svg { max-width: 100%; height: auto; display: block; }

/* ВСЕГДА белый фон у SVG (у многих экспортов фон прозрачный) */
.__svg-host { background: #fff !important; }
.__svg-host svg { background: #fff !important; }
`;

function normalizeSvg(svgEl, mount) {
  svgEl.style.maxWidth = "100%";
  svgEl.style.height = "auto";
  svgEl.style.display = "block";
  if (!svgEl.getAttribute("width")) svgEl.setAttribute("width", "100%");
  svgEl.removeAttribute("height");
  if (!svgEl.getAttribute("preserveAspectRatio")) {
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  if (!svgEl.getAttribute("viewBox")) {
    try {
      mount.appendChild(svgEl);
      const bbox = svgEl.getBBox();
      const vb = [bbox.x, bbox.y, Math.max(1, bbox.width), Math.max(1, bbox.height)].join(" ");
      svgEl.setAttribute("viewBox", vb);
      svgEl.remove();
    } catch {}
  }

  try {
    const vb = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const vbW = vb?.[2] || 1000;
    const vbH = vb?.[3] || 1000;
    svgEl.querySelectorAll("image").forEach((img) => {
      if (!img.hasAttribute("width")) img.setAttribute("width", vbW);
      if (!img.hasAttribute("height")) img.setAttribute("height", vbH);
    });
  } catch {}

  return svgEl;
}

export default function SvgPanel({
  refEl,
  url,
  svgContent,
  hotspotToStructures = {},
  hotspotHighlight = [],
  title = "",
  onHotspotClick,
}) {
  const svgMountRef = useRef(null);
  const { html, error } = useInlineSvg({ url, svgContent });
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    const id = "svg-hotspot-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.innerHTML = styleOnce;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const mount = svgMountRef.current;
    if (!mount) return;
    mount.innerHTML = "";

    let detach = () => {};
    if (html) {
      let root;
      try {
        const doc = new DOMParser().parseFromString(html, "image/svg+xml");
        const parsedSvg = doc.documentElement;
        const svgEl = document.importNode(parsedSvg, true);
        const normalized = normalizeSvg(svgEl, mount);
        mount.appendChild(normalized);
        root = normalized;
      } catch {
        mount.innerHTML = html;
        root = mount.querySelector("svg") || mount;
      }

      const allIds = Object.keys(hotspotToStructures || {});
      const { cleanup } = attachHotspotHandlers(root, {
        hotspotIds: allIds,
        highlightIds: (hotspotHighlight || []).map(String),
        onClick: (id) => onHotspotClick?.(id),
      });
      detach = cleanup;
    }

    return () => detach();
  }, [html, hotspotToStructures, hotspotHighlight, onHotspotClick]);

  const tip = useMemo(() => {
    const ids = Object.keys(hotspotToStructures || {});
    if (!ids.length) return "";
    const act = hotspotHighlight?.length ? ` • активные: ${hotspotHighlight.join(", ")}` : "";
    return `Кликабельно: ${ids.join(", ")}${act}`;
  }, [hotspotToStructures, hotspotHighlight]);

  return (
    <section ref={refEl} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
        <span>{title || "Схема / изображение"}</span>
        {url ? (
            <button
            onClick={() => setZoomOpen(true)}
            className="text-slate-800 dark:text-slate-900 text-xs px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 shadow-sm"
            title="Открыть крупно"
            >
            🔍 Увеличить
            </button>
        ) : null}
        </div>

      {error ? (
        <div className="p-3 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-200">
          Не удалось загрузить SVG из внешнего источника ({error}).<br/>
          Показ без интерактива:
          <div className="mt-2 overflow-auto __svg-host">
            {url ? <img src={url} alt={title} className="max-w-full h-auto" /> : <em>(нет данных)</em>}
          </div>
        </div>
      ) : html ? (
        <div
          className="__svg-host p-2 overflow-auto"
          title={tip}
          style={{ maxHeight: "70vh" }}
        >
          <div ref={svgMountRef} className="inline-block max-w-full" />
        </div>
      ) : (
        <div className="p-3 text-slate-500">(загрузка изображения…)</div>
      )}

      {url && (
        <Lightbox open={zoomOpen} src={url} alt={title} onClose={() => setZoomOpen(false)} />
      )}
    </section>
  );
}

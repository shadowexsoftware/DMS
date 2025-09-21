// src/pages/Viewer/hooks/useSvgHotspots.js
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Надёжная нормализация (пробелы, регистр, NBSP)
 */
function norm(s) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * "Слипшаяся" форма для неточного совпадения:
 * убираем пробелы/дефисы/скобки/точки и похожие знаки
 */
function slug(s) {
  return norm(s).replace(/[\s\-()[\]{}<>·•.,;:，、．/\\]+/g, "");
}

/**
 * Извлекаем числовые токены (и их числовую форму)
 */
function numbersFrom(s) {
  const m = String(s ?? "").match(/\d+/g);
  if (!m) return [];
  const set = new Set();
  m.forEach((n) => { set.add(n); set.add(String(+n)); });
  return Array.from(set);
}

/**
 * Построение DOM-индекса по SVG
 */
function buildDomIndex(root, selector, attrKeys) {
  const byNormText = new Map();
  const bySlugText = new Map();
  const byNumber = new Map();
  const byAttr = new Map();

  // 1) тексты
  const texts = Array.from(root.querySelectorAll("text"));
  texts.forEach((t) => {
    const txt = t.textContent ?? "";
    const n = norm(txt);
    const s = slug(txt);
    if (n) {
      if (!byNormText.has(n)) byNormText.set(n, []);
      byNormText.get(n).push(t);
    }
    if (s) {
      if (!bySlugText.has(s)) bySlugText.set(s, []);
      bySlugText.get(s).push(t);
    }
    numbersFrom(txt).forEach((num) => {
      if (!byNumber.has(num)) byNumber.set(num, []);
      byNumber.get(num).push(t);
    });
  });

  // 2) id / data-*
  const attrSelector = attrKeys.map((k) => `[${k}]`).join(",");
  const attrCandidates = Array.from(root.querySelectorAll(attrSelector));
  attrCandidates.forEach((el) => {
    attrKeys.forEach((k) => {
      const v = el.getAttribute(k);
      if (!v) return;
      const key = norm(v);
      if (!key) return;
      if (!byAttr.has(key)) byAttr.set(key, []);
      byAttr.get(key).push(el);
    });
  });

  // 3) опционально добираем ещё элементы по произвольному селектору
  if (selector) {
    const extra = Array.from(root.querySelectorAll(selector));
    extra.forEach((el) => {
      if (el.tagName.toLowerCase() === "text") return; // уже учли
      const txt = el.textContent ?? "";
      const n = norm(txt);
      const s = slug(txt);
      if (n) {
        if (!byNormText.has(n)) byNormText.set(n, []);
        byNormText.get(n).push(el);
      }
      if (s) {
        if (!bySlugText.has(s)) bySlugText.set(s, []);
        bySlugText.get(s).push(el);
      }
      numbersFrom(txt).forEach((num) => {
        if (!byNumber.has(num)) byNumber.set(num, []);
        byNumber.get(num).push(el);
      });
    });
  }

  return { byNormText, bySlugText, byNumber, byAttr };
}

/**
 * Варианты ключей хотспота, которые будем пробовать
 */
function hotspotKeyVariants(h) {
  const raw = String(h?.hotspotNum || h?.hotspotName || "").trim();
  const base = norm(raw);
  const out = [];
  if (base) out.push(base);

  // без внешних скобок
  if (base.startsWith("(") && base.endsWith(")")) {
    const inner = base.slice(1, -1).trim();
    if (inner) out.push(inner);
  }

  // без любых скобок
  const noParens = base.replace(/[()]/g, "").trim();
  if (noParens && noParens !== base) out.push(noParens);

  // слитая форма
  const s = slug(raw);
  if (s) out.push(`__SLUG__:${s}`);

  // чисто числовые токены
  numbersFrom(raw).forEach((n) => out.push(`__NUM__:${n}`));

  // явный атрибутный ключ (на случай, если у элементов так же)
  out.push(`__ATTR__:${base}`);
  if (noParens && noParens !== base) out.push(`__ATTR__:${noParens}`);

  return Array.from(new Set(out));
}

/**
 * Возвращает элементы по одному варианту ключа.
 */
function matchByVariant(variant, index) {
  if (variant.startsWith("__NUM__:")) {
    const k = variant.slice("__NUM__:".length);
    return index.byNumber.get(k) || [];
  }
  if (variant.startsWith("__SLUG__:")) {
    const k = variant.slice("__SLUG__:".length);
    return index.bySlugText.get(k) || [];
  }
  if (variant.startsWith("__ATTR__:")) {
    const k = variant.slice("__ATTR__:".length);
    return index.byAttr.get(k) || [];
  }
  // точный текст
  const exact = index.byNormText.get(variant) || [];
  if (exact.length) return exact;

  // частичное включение (на случай длинных надписей)
  // берём первое совпадение, чтобы не размечать слишком много
  for (const [txt, arr] of index.byNormText.entries()) {
    if (txt.includes(variant)) return arr;
  }
  return [];
}

/**
 * Класс по типу хотспота
 */
function defaultTypeClass(t) {
  return `__c-type-${t || 10}`;
}

/**
 * Хук привязки хотспотов к узлам SVG.
 *
 * @param {Object} options
 *  - svgRootRef: React ref на корневой <svg>
 *  - hotspots: массив хотспотов
 *  - onHotspot: (h, el, evt) => void — вызывается при клике/Enter/Space
 *  - typeClassMap: {10:string,20:string,30:string}
 *  - selector: доп. селектор для кандидатов (по умолчанию достаточно)
 *  - attrKeys: список атрибутов для сопоставления (id/data-*)
 *  - debug: печатать в консоль статистику
 */
export default function useSvgHotspots({
  svgRootRef,
  hotspots,
  onHotspot,
  typeClassMap = {},
  selector = "",
  attrKeys = ["id", "data-id", "data-name", "data-hotspot"],
  debug = false,
}) {
  const el2hotRef = useRef(new WeakMap());
  const trackedElsRef = useRef(new Set());
  const listenersRef = useRef({ added: false });
  const [stats, setStats] = useState({ total: 0, matched: 0, missed: [] });

  // быстрый доступ к классам по типу
  const classForType = (t) => typeClassMap[t] || defaultTypeClass(t);

  // Снятие разметки и обработчиков
  function cleanup(root) {
    try {
      // 1) обработчики
      if (root && listenersRef.current.added) {
        root.removeEventListener("click", onClickDeleg, true);
        root.removeEventListener("keydown", onKeyDeleg, true);
        listenersRef.current.added = false;
      }
      // 2) наши классы/атрибуты
      trackedElsRef.current.forEach((el) => {
        try {
          el.classList.remove("__c-hotspot", "__c-hotspot--hover", "__c-type-10", "__c-type-20", "__c-type-30");
          if (el.getAttribute("role") === "button") el.removeAttribute("role");
          if (el.getAttribute("tabindex") === "0") el.removeAttribute("tabindex");
        } catch {}
      });
      trackedElsRef.current.clear();
      el2hotRef.current = new WeakMap();
    } catch {}
  }

  const onClickDeleg = (e) => {
    const root = svgRootRef.current;
    if (!root) return;
    const el = e.target?.closest?.(".__c-hotspot");
    if (!el || !root.contains(el)) return;
    e.stopPropagation();
    const h = el2hotRef.current.get(el);
    if (h) onHotspot?.(h, el, e);
  };

  const onKeyDeleg = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const root = svgRootRef.current;
    if (!root) return;
    const el = e.target?.closest?.(".__c-hotspot");
    if (!el || !root.contains(el)) return;
    e.preventDefault();
    const h = el2hotRef.current.get(el);
    if (h) onHotspot?.(h, el, e);
  };

  // Основная привязка
  useEffect(() => {
    const root = svgRootRef.current;
    cleanup(root);
    if (!root || !Array.isArray(hotspots) || hotspots.length === 0) {
      setStats({ total: hotspots?.length || 0, matched: 0, missed: hotspots || [] });
      return;
    }

    const index = buildDomIndex(root, selector, attrKeys);

    let matched = 0;
    const missed = [];

    hotspots.forEach((h) => {
      const variants = hotspotKeyVariants(h);
      let nodes = [];
      for (const v of variants) {
        nodes = matchByVariant(v, index);
        if (nodes && nodes.length) break;
      }
      if (!nodes || !nodes.length) {
        missed.push(h);
        return;
      }

      nodes.forEach((el) => {
        try {
          el.classList.add("__c-hotspot", classForType(h.hotspotType || 10));
          if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
          if (!el.hasAttribute("role")) el.setAttribute("role", "button");
          el2hotRef.current.set(el, h);
          trackedElsRef.current.add(el);
        } catch {}
      });
      matched += 1;
    });

    // Делегированные слушатели (один раз на текущее root)
    root.addEventListener("click", onClickDeleg, true);
    root.addEventListener("keydown", onKeyDeleg, true);
    listenersRef.current.added = true;

    const nextStats = { total: hotspots.length, matched, missed };
    setStats(nextStats);
    if (debug) {
      // полезно для отладки: кто не привязался и почему
      // eslint-disable-next-line no-console
      console.debug("[useSvgHotspots] matched:", matched, "of", hotspots.length, {
        missed: missed.map((h) => h.hotspotNum || h.hotspotName),
      });
    }

    return () => cleanup(root);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRootRef.current, hotspots, selector]);

  /**
   * Точный поиск DOM-узла по хотспоту — пригодится для автозума/подсветки.
   */
  const findNode = (h) => {
    const root = svgRootRef.current;
    if (!root) return null;
    // уже размеченные узлы храним в WeakMap
    for (const el of trackedElsRef.current) {
      if (el2hotRef.current.get(el) === h) return el;
    }
    // если вдруг не размечен (или менялся список), пробуем матчеры на лету
    const index = buildDomIndex(root, selector, attrKeys);
    const variants = hotspotKeyVariants(h);
    for (const v of variants) {
      const nodes = matchByVariant(v, index);
      if (nodes && nodes.length) return nodes[0] || null;
    }
    return null;
  };

  return {
    /** первый подходящий DOM-элемент для хотспота */
    findNode,
    /** статистика: сколько привязалось и кто пропущен */
    stats,
    /** хелпер: перезапустить привязку вручную — достаточно поменять ссылочный prop hotspots */
    rebind: () => {}, // no-op, обновление триггерится зависимостями эффекта
  };
}

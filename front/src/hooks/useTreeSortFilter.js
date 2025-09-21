// src/hooks/useTreeSortFilter.js
// src/hooks/useTreeSortFilter.js
import { useMemo, useCallback } from "react";

export default function useTreeSortFilter({ childrenResp, q, sortMode }) {
  // ===== настройки фильтра =====
  const MIN_CHARS_TITLE = 3; // для title
  const MIN_CHARS_CODE  = 2; // для кода (фрагменты допускаются)

  // Режимы сравнения
  const USE_PREFIX_MATCH_FOR_TITLE = true; // по title — начало слова
  const ALLOW_CODE_FRAGMENT = true;        // по коду — фрагмент (includes) вместо startsWith

  // ===== исходные данные =====
  const structureMap = useMemo(() => {
    return (
      childrenResp?.data?.structureMap ||
      childrenResp?.data?.data?.structureMap ||
      {}
    );
  }, [childrenResp]);

  // q — «применённый» запрос
  const qNorm = (q || "").trim().toLowerCase();

  // Берём ТОЛЬКО первое слово (до пробела)
  const firstToken = useMemo(() => {
    return qNorm.split(/\s+/).filter(Boolean)[0] || "";
  }, [qNorm]);

  // ===== хелперы =====
  const normalizeCode = useCallback((s) => {
    // убираем всё, кроме латиницы и цифр
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }, []);

  // Заголовок узла (то, что показываем в левой колонке)
  const itemTitle = useCallback((it) => {
    return String(
      it?.materialName ??
      it?.structureName ??
      "" // только title — без кодов
    );
  }, []);

  // Все возможные коды, по которым ищем
  const itemCodes = useCallback((it) => {
    return [
      it?.materialCode,     // <-- главное, тут лежит X03-10010015
      it?.structureCode,
      it?.itemId
    ].map(x => String(x ?? ""));
  }, []);

  // Эвристика: похоже ли первое слово на код?
  // Любая строка, где есть цифры или -/_, считаем кодом
  const looksLikeCode = useCallback((token) => {
    if (!token) return false;
    return /[-_\d]/.test(token);
  }, []);

  // Включать фильтр?
  const modeIsCode = looksLikeCode(firstToken);
  const tokenPassesLength =
    firstToken.length >= (modeIsCode ? MIN_CHARS_CODE : MIN_CHARS_TITLE);

  // ===== сортировки =====
  const baseSort = useCallback((arr) => {
    const copy = [...arr];
    copy.sort((a, b) => {
      const sa = Number.isFinite(+a?.sort) ? +a.sort : Number.MAX_SAFE_INTEGER;
      const sb = Number.isFinite(+b?.sort) ? +b.sort : Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      const na = (a?.materialName || a?.structureName || "").toLowerCase();
      const nb = (b?.materialName || b?.structureName || "").toLowerCase();
      return na.localeCompare(nb);
    });
    return copy;
  }, []);

  const applySort = useCallback((arr) => {
    if (sortMode === "default") return baseSort(arr);
    const copy = [...arr];
    const nm = (x) => (x.materialName || x.structureName || "").toLowerCase();
    if (sortMode === "name_asc")  copy.sort((a, b) => nm(a).localeCompare(nm(b)));
    if (sortMode === "name_desc") copy.sort((a, b) => nm(b).localeCompare(nm(a)));
    if (sortMode === "code_asc")
      copy.sort((a, b) =>
        String(a.structureCode || "").localeCompare(String(b.structureCode || ""))
      );
    if (sortMode === "code_desc")
      copy.sort((a, b) =>
        String(b.structureCode || "").localeCompare(String(a.structureCode || ""))
      );
    return copy;
  }, [sortMode, baseSort]);

  // ===== матчеры =====
  const matchByTitle = useCallback((title, token) => {
    if (!token) return true;
    const t = String(title || "").toLowerCase();
    if (USE_PREFIX_MATCH_FOR_TITLE) {
      const words = t.split(/[\s\-_/.,;:()]+/).filter(Boolean);
      for (const w of words) if (w.startsWith(token)) return true;
      return false;
    }
    return t.includes(token);
  }, []);

  // матч по одному коду (нормализуем оба)
  const matchOneCode = useCallback((codeRaw, tokenRaw) => {
    if (!tokenRaw) return true;
    const c = normalizeCode(codeRaw);
    const t = normalizeCode(tokenRaw);
    if (!t) return true;
    return ALLOW_CODE_FRAGMENT ? c.includes(t) : c.startsWith(t);
  }, [normalizeCode]);

  // матч по любому из кодов узла
  const matchByAnyCode = useCallback((codes, token) => {
    for (const c of codes) {
      if (matchOneCode(c, token)) return true;
    }
    return false;
  }, [matchOneCode]);

  const isMatch = useCallback((it, token) => {
    if (!token) return true;
    if (looksLikeCode(token)) return matchByAnyCode(itemCodes(it), token);
    return matchByTitle(itemTitle(it), token);
  }, [itemTitle, itemCodes, looksLikeCode, matchByAnyCode, matchByTitle]);

  const childrenOf = useCallback(
    (key) => (Array.isArray(structureMap[key]) ? structureMap[key] : []),
    [structureMap]
  );

  const deepFilterSection = useCallback(function rec(parentKey, token) {
    const arr = childrenOf(parentKey);
    if (!tokenPassesLength) return applySort(arr); // нет фильтра — просто сортируем

    const out = [];
    for (const it of arr) {
      const childKey = String(it?.structureCode || "");
      const hasDeep = rec(childKey, token).length > 0;
      if (isMatch(it, token) || hasDeep) out.push(it);
    }
    return applySort(out);
  }, [childrenOf, isMatch, applySort, tokenPassesLength]);

  const collectExpandedForQuery = useCallback(function rec(parentKey, token, acc = new Set()) {
    if (!tokenPassesLength) return acc;
    const arr = childrenOf(parentKey);
    for (const it of arr) {
      const childKey = String(it?.structureCode || "");
      if (!childKey) continue;
      const hasDeep = deepFilterSection(childKey, token).length > 0;
      if (hasDeep) {
        acc.add(childKey);
        rec(childKey, token, acc);
      }
    }
    return acc;
  }, [childrenOf, deepFilterSection, tokenPassesLength]);

  // Публичные методы — такая же логика порогов
  const getSectionDeep = useCallback((parentKey, qStr) => {
    const norm = String(qStr ?? "").trim().toLowerCase();
    const first = (norm.split(/\s+/).filter(Boolean)[0] || "");
    const isCode = looksLikeCode(first);
    const ok = first.length >= (isCode ? MIN_CHARS_CODE : MIN_CHARS_TITLE);
    const token = ok ? first : "";
    return deepFilterSection(parentKey, token);
  }, [deepFilterSection, looksLikeCode]);

  const autoExpandedKeys = useCallback((parentKey, qStr) => {
    const norm = String(qStr ?? "").trim().toLowerCase();
    const first = (norm.split(/\s+/).filter(Boolean)[0] || "");
    const isCode = looksLikeCode(first);
    const ok = first.length >= (isCode ? MIN_CHARS_CODE : MIN_CHARS_TITLE);
    const token = ok ? first : "";
    return collectExpandedForQuery(parentKey, token, new Set());
  }, [collectExpandedForQuery, looksLikeCode]);

  // ===== выбор корня =====
  const findKeyWithModel = useCallback((map, model) => {
    const keys = Object.keys(map || {});
    const test = (x) => {
      const cand = [x?.structureName, x?.itemId, x?.materialName]
        .map((v) => String(v ?? "").trim());
      return cand.includes(String(model).trim());
    };
    return keys.find((k) => (map[k] || []).some(test)) || "";
  }, []);

  const pickLargestKey = useCallback((mapObj) => {
    const map = mapObj || structureMap;
    let bestKey = "";
    let bestLen = -1;
    for (const k of Object.keys(map || {})) {
      const len = Array.isArray(map[k]) ? map[k].length : 0;
      if (len > bestLen) { bestLen = len; bestKey = k; }
    }
    if (!bestKey) bestKey = Object.keys(map || {})[0] || "";
    return bestKey;
  }, [structureMap]);

  const computeRootKey = useCallback((model) => {
    const map = structureMap;
    if (!map || !Object.keys(map).length) return "";

    const k1 = findKeyWithModel(map, model);
    if (!k1) return pickLargestKey(map);

    const sortedK1 = baseSort(map[k1] || []);
    const modelItem =
      sortedK1.find((x) => {
        const s = String(model).trim();
        return [x?.structureName, x?.itemId, x?.materialName]
          .map((v) => String(v ?? "").trim())
          .includes(s);
      }) || sortedK1[0];

    const k2 = modelItem?.structureCode;
    if (!k2 || !map[k2]) return k2 || pickLargestKey(map);

    const k2First = baseSort(map[k2])[0];
    const k3 = k2First?.structureCode;

    if (k3 && map[k3]) return k3;
    if (k2 && map[k2]) return k2;
    return pickLargestKey(map);
  }, [structureMap, findKeyWithModel, pickLargestKey, baseSort]);

  // ===== публичное API =====
  return {
    structureMap,
    getSectionDeep,
    autoExpandedKeys,
    computeRootKey,
  };
}

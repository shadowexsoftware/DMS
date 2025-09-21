//src/pages/Viewer/components/TreeView.jsx

import React from "react";

function Highlight({ text, q }) {
  const t = String(text ?? "");
  const needle = (q || "").trim().toLowerCase();
  if (!needle) return <>{t}</>;

  const lower = t.toLowerCase();
  const parts = [];
  let i = 0;
  while (i < t.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) { parts.push(t.slice(i)); break; }
    if (idx > i) parts.push(t.slice(i, idx));
    parts.push(
      <mark key={idx} className="rounded px-0.5 bg-yellow-200/70 dark:bg-yellow-500/40 text-inherit">
        {t.slice(idx, idx + needle.length)}
      </mark>
    );
    i = idx + needle.length;
  }
  return <>{parts}</>;
}

export default function TreeView({
  structureMap,
  rootKey,
  q,
  expandedKeys,
  getSectionDeep,
  onToggleExpand,
  onOpenNode,
  selected,
}) {
  if (!rootKey) return <div className="text-slate-500">(выберите модель и нажмите «Поиск»)</div>;
  if (!structureMap[rootKey]) return <div className="text-slate-500">(нет данных для раздела)</div>;

  const header = (
    <div
      key={`hdr-${rootKey}`}
      className="px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 border-t border-dashed first:border-t-0 border-slate-200/70 dark:border-slate-700/60"
    >
      {rootKey} <span className="text-slate-400">({(structureMap[rootKey] || []).length})</span>
    </div>
  );

  function renderSection(parentKey, depth) {
    const arr = getSectionDeep(parentKey, q);
    const out = [];

    arr.forEach((item, idx) => {
      const labelRaw = item.materialName || item.structureName || item.itemId || item.structureCode || "-";
      const hasChildren = (k) => Array.isArray(structureMap[k]) && structureMap[k].length > 0;
      const isExpandable = hasChildren(item.structureCode);
      const isExpanded = isExpandable && expandedKeys.has(item.structureCode);
      const isSelected =
        selected?.item?.structureCode === item.structureCode &&
        selected?.item?.itemId === item.itemId;

      const nodeKey = `${parentKey}-${item.structureCode}-${item.itemId || ""}-${idx}`;

      out.push(
        <div key={nodeKey}>
          <div
            className={
              "m-1 w-[calc(100%-0.5rem)] rounded-xl px-2 py-1 text-left flex items-stretch gap-1 " +
              (isSelected
                ? "bg-indigo-100 dark:bg-slate-800/70 ring-1 ring-indigo-200 dark:ring-slate-700"
                : "hover:bg-indigo-50 dark:hover:bg-slate-800")
            }
            style={{ paddingLeft: 8 + depth * 18 }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(item); }}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs aria-expanded:rotate-90 transition-transform"
              aria-expanded={isExpanded}
              title={isExpandable ? (isExpanded ? "Свернуть" : "Развернуть") : "Нет вложений"}
            >
              {isExpandable ? (isExpanded ? "▼" : "►") : "•"}
            </button>

            <button
              onClick={() => onOpenNode(item, parentKey)}
              className="flex-1 text-left rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              title={labelRaw}
              data-structure-code={item.structureCode}
              id={`tree-node-${item.structureCode}`}
              aria-current={isSelected ? "true" : undefined}
            >
              <div className="font-medium whitespace-normal break-words leading-snug">
                <Highlight text={labelRaw} q={q} />
              </div>
            </button>
          </div>

          {isExpanded && <div>{renderSection(item.structureCode, depth + 1)}</div>}
        </div>
      );
    });

    return out;
  }

  return [header, ...renderSection(rootKey, 0)];
}

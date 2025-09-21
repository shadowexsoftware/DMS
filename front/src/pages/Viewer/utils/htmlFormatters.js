//src/pages/Viewer/utils/htmlFormatters.js

export function safePickHtml(resp) {
  const d = resp?.data?.data ?? resp?.data ?? "";
  const s = typeof d === "string" ? d : "";
  return s || "<div class='text-slate-500'>(нет данных)</div>";
}

export function formatCircuit(resp) {
  const d = resp?.data?.data ?? resp?.data ?? null;
  const list = Array.isArray(d?.structureCircuitList) ? d.structureCircuitList : [];
  if (!list.length) return "<div class='text-slate-500'>(нет данных)</div>";

  const blocks = list.map((it, idx) => {
    const name = (it?.circuitResourceName || it?.resourceName || `Схема #${idx + 1}`).toString();
    const url  = (it?.fileUrl || "").toString();
    const imgOk = /\.(svg|png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
    const img = imgOk
      ? `<div class="my-3"><img src="${url}" alt="${name}" style="max-width:100%;height:auto;border-radius:.5rem"/></div>`
      : "";
    const link = url ? `<div class="text-xs"><a href="${url}" target="_blank" rel="noreferrer">Открыть исходник</a></div>` : "";
    return `<div class="my-2">
              <div class="font-medium">${name}</div>
              ${img || "<div class='text-slate-500'>(изображение недоступно)</div>"}
              ${link}
            </div>`;
  });

  return blocks.join('<hr class="my-4 border-slate-200 dark:border-slate-700"/>');
}

export function formatFunctionDesc(resp) {
  const d = resp?.data?.data ?? resp?.data ?? null;
  const list = Array.isArray(d?.innerDeatilDtoList) ? d.innerDeatilDtoList : [];
  if (!list.length) return "<div class='text-slate-500'>(нет данных)</div>";

  const parts = [];
  for (const it of list) {
    const html = (it?.content || "").trim();
    if (html) parts.push(html);
    if (it?.fileUrl) {
      const ok = /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(String(it.fileUrl));
      if (ok) {
        parts.push(`<div class="my-3"><img src="${it.fileUrl}" alt="" style="max-width:100%;height:auto;border-radius:.5rem"/></div>`);
      }
    }
  }
  return parts.join('<hr class="my-4 border-slate-200 dark:border-slate-700"/>')
      || "<div class='text-slate-500'>(нет данных)</div>";
}

export function formatDestuffing(resp) {
  const d = resp?.data?.data ?? resp?.data ?? null;
  if (!d) return "<div class='text-slate-500'>(нет данных)</div>";

  const parts = [];

  // верхняя схема расположения, если есть
  const locUrl = d?.materialLocation?.fileUrl;
  if (locUrl) {
    const isImg = /\.(svg|png|jpg|jpeg|gif|webp)(\?|$)/i.test(String(locUrl));
    parts.push(
      `<div class="my-3">
         <div class="text-sm text-slate-500">Схема расположения</div>
         ${isImg ? `<img src="${locUrl}" alt="location" style="max-width:100%;height:auto;border-radius:.5rem"/>`
                 : `<a href="${locUrl}" target="_blank" rel="noreferrer">Открыть файл</a>`}
       </div>`
    );
  }

  // внимание
  const attention = Array.isArray(d.attentionList) ? d.attentionList : [];
  if (attention.length) {
    const lis = attention
      .sort((a,b)=>(a.sort??0)-(b.sort??0))
      .map(a=>`<li class="mb-1">${String(a.content||"").trim()||"(пусто)"}</li>`)
      .join("");
    parts.push(
      `<div class="my-4">
         <div class="font-semibold">Внимание</div>
         <ul class="list-disc pl-5 mt-1">${lis}</ul>
       </div>`
    );
  }

  // вкладки шагов
  const tabs = Array.isArray(d.tabDToList) ? d.tabDToList : [];
  for (const tab of tabs.sort((a,b)=>(a.sort??0)-(b.sort??0))) {
    const steps = Array.isArray(tab.stepToList) ? tab.stepToList : [];
    if (!steps.length) continue;

    const stepBlocks = steps
      .sort((a,b)=>(a.sort??0)-(b.sort??0))
      .map((s, i) => {
        const explain = String(s.stepExplain || "").trim(); // уже HTML
        const fileUrl = s.fileUrl ? String(s.fileUrl) : "";
        const hasImg = /\.(svg|png|jpg|jpeg|gif|webp)(\?|$)/i.test(fileUrl);
        const imgHtml = fileUrl
          ? (hasImg
              ? `<div class="my-2"><img src="${fileUrl}" alt="" style="max-width:100%;height:auto;border-radius:.5rem"/></div>`
              : `<div class="my-2 text-xs"><a href="${fileUrl}" target="_blank" rel="noreferrer">Файл шага</a></div>`)
          : "";

        return `<div class="py-2">
                  <div class="text-sm text-slate-500">Шаг ${s.sort ?? (i+1)}</div>
                  <div>${explain || "(нет описания)"}</div>
                  ${imgHtml}
                </div>`;
      })
      .join('<hr class="my-3 border-slate-200 dark:border-slate-700"/>');

    parts.push(
      `<section class="my-5">
         <h3 class="font-semibold text-base">${tab.labelName || "Шаги"}</h3>
         <div class="mt-2">${stepBlocks}</div>
       </section>`
    );
  }

  const html = parts.join("\n").trim();
  return html || "<div class='text-slate-500'>(нет данных)</div>";
}


export function formatPartDetail(resp) {
  const d = resp?.data?.data ?? resp?.data ?? null;
  if (!d) return "<div class='text-slate-500'>(нет данных)</div>";

  const text = v => (v === null || v === undefined ? "" : String(v));
  const num  = v => (v === null || v === undefined ? "" : String(v));
  const boolRu = v => (v === true ? "Да" : v === false ? "Нет" : "");

  const curWh = text(d.warehouseName) || "--";
  const name  = text(d.materialName);
  const qty   = num(d.availableQty);
  const price = num(d.retailPrice);

  const invHtml = `
    <section class="my-3">
      <div class="font-semibold mb-2">Запасы и цены</div>
      <div class="text-sm text-slate-500 mb-2">Текущий склад: ${curWh}</div>
      <table class="w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-800/60">
            <th class="text-left p-2 border-b border-slate-200 dark:border-slate-700">Наименование детали</th>
            <th class="text-left p-2 border-b border-slate-200 dark:border-slate-700">Объём запасов</th>
            <th class="text-left p-2 border-b border-slate-200 dark:border-slate-700">Цена</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="p-2 align-top">${name}</td>
            <td class="p-2 align-top">${qty}</td>
            <td class="p-2 align-top">${price}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;

  const rows = [
    ["Расход", text(d.usageValue ?? d.maintenanceDosage)],
    ["Ед. изм.", text(d.measurementUnitName || d.measurementUnit)],
    ["Маркировка цветных деталей", text(d.ieIdentifyCode)],
    ["Условия использования", text(d.zhDesc)],
    ["Модель автомобиля", text(d.applicableModel)],
    ["№ деталей поставщика", text(d.supplierReference)],
    ["Миним. кол-во упаковки поставщика", num(d.supplyMinPack)],
    ["Миним. кол-во упаковки PDC", num(d.pdcMinPack)],
    ["Гарантийный срок", boolRu(d.warrantyPeriod)],
  ];

  const otherRows = rows.map(([k,v]) => `
    <tr>
      <td class="p-2 w-[45%] border-t border-slate-200 dark:border-slate-700">${k}</td>
      <td class="p-2 border-t border-slate-200 dark:border-slate-700">${v}</td>
    </tr>
  `).join("");

  const otherHtml = `
    <section class="my-4">
      <div class="font-semibold mb-2">Другие информации</div>
      <table class="w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-800/60">
            <th class="text-left p-2">Свойства</th>
            <th class="text-left p-2">Значение свойств</th>
          </tr>
        </thead>
        <tbody>${otherRows}</tbody>
      </table>
    </section>
  `;

  const html = `${invHtml}${otherHtml}`.trim();
  return html || "<div class='text-slate-500'>(нет данных)</div>";
}

export function formatTechnical(resp) {
  // Берём полезную нагрузку
  const d = resp?.data?.data ?? resp?.data ?? null;
  const list = Array.isArray(d?.details) ? d.details : [];
  if (!list.length) return "<div class='text-slate-500'>(нет данных)</div>";

  // Склеиваем все куски контента + возможные файлы
  const blocks = list
    .sort((a, b) => {
      // Попробуем разумно отсортировать: по createTime/ id / ничего
      const ta = new Date(a?.createTime || 0).getTime();
      const tb = new Date(b?.createTime || 0).getTime();
      if (ta && tb && ta !== tb) return ta - tb;
      return (a?.id ?? 0) - (b?.id ?? 0);
    })
    .map((it, i) => {
      const html = (it?.content || "").trim();
      const url = (it?.fileUrl || "").trim();
      const isImg = /\.(svg|png|jpe?g|gif|webp)(\?|$)/i.test(url);
      const fileHtml = url
        ? (isImg
            ? `<div class="my-3"><img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:.5rem"/></div>`
            : `<div class="text-xs my-2"><a href="${url}" target="_blank" rel="noreferrer">Вложение #${i + 1}</a></div>`)
        : "";
      return `${html || ""}${fileHtml}`;
    })
    .filter(Boolean);

  const res = blocks.join('<hr class="my-4 border-slate-200 dark:border-slate-700"/>');
  return res || "<div class='text-slate-500'>(нет данных)</div>";
}

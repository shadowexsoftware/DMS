// src/api/export.js
import { getBaseUrl, getAuthHeaders } from "./client.js";

/**
 * Экспорт «Документа детали» (пример POST JSON -> Blob)
 * @param {object} payload - данные для экспорта
 * @returns {Promise<Blob>}
 */
export async function exportPartDoc(payload) {
  const url = `${getBaseUrl()}/export/part`;

  // ВАЖНО: передаём именно экземпляр Headers, а не распыляем его в объект
  const headers = getAuthHeaders();
  headers.set("content-type", "application/json");

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    credentials: "include",
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      // игнорируем parse error, оставляем msg как есть
    }
    throw new Error(msg);
  }

  return await res.blob();
}

// src/api/client.js
import { API_BASE } from "./config";
import { getSession } from "./auth";

/** Вернуть базовый URL API (удобно для модулей-обёрток) */
export const getBaseUrl = () => API_BASE;

/** Сформировать Headers с Accept и Authorization (если есть токен) */
export function getAuthHeaders(init = {}) {
  const sess = getSession();
  const h = new Headers(init);
  h.set("accept", "application/json");
  if (sess?.token) h.set("authorization", `Bearer ${sess.token}`);
  return h;
}

/** Унифицированный fetch для JSON/текста, с автоматическим JSON.stringify */
export async function apiFetch(
  path,
  { method = "GET", headers = {}, body, ...rest } = {}
) {
  const h = getAuthHeaders(headers);
  if (body && !(body instanceof FormData)) {
    h.set("content-type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
    ...rest,
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof data === "string" ? data : data?.error || "Ошибка запроса";
    throw new Error(msg);
  }
  return data;
}

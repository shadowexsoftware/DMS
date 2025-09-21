// src/api/auth.js
const KEY = "dmsviewer.session";

export function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
export function setSession(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}
export function clearSession() {
  localStorage.removeItem(KEY);
}

import { apiFetch } from "./client";

// регистрация
export async function register({ username, email, password }) {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: { username, email, password }
  });
  // ожидаем { ok, token, user }
  const session = { token: r.token, user: r.user };
  setSession(session);
  return session;
}

// вход
export async function login({ login, password }) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    body: { login, password }
  });
  const session = { token: r.token, user: r.user };
  setSession(session);
  return session;
}

// проверка токена
export async function me() {
  return apiFetch("/auth/me", { method: "GET" }); // { ok, sub }
}

// выход
export function logout() {
  clearSession();
}

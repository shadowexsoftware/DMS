//src/api/admin.js
// Единая точка для вызовов бэка админки (под твои маршруты)
import { apiFetch } from "./client.js";

// ===== USERS =====
// Твой бэк: GET /admin/users?limit=&offset=  (без поиска и total)
export const listUsers = ({ limit = 20, offset = 0 }) =>
  apiFetch(`/admin/users?limit=${limit}&offset=${offset}`);

// Бан/разбан/промоут/демоут
export const banUser = (id) =>
  apiFetch(`/admin/users/${id}/ban`, { method: "POST" });

export const unbanUser = (id) =>
  apiFetch(`/admin/users/${id}/unban`, { method: "POST" });

export const promoteUser = (id) =>
  apiFetch(`/admin/users/${id}/promote`, { method: "POST" });

export const demoteUser = (id) =>
  apiFetch(`/admin/users/${id}/demote`, { method: "POST" });

// (опционально) создание пользователя через админку — маршрут добавлен ниже во Flask-сниппете
export const createUserAdmin = (body) =>
  apiFetch(`/admin/users/create`, { method: "POST", body });

// ===== SETTINGS (регистрация) =====
// Твой бэк: GET/POST /admin/config/registration
export const getRegistrationConfig = () =>
  apiFetch(`/admin/config/registration`); // -> { ok, registration_open }

export const setRegistrationConfig = (open) =>
  apiFetch(`/admin/config/registration`, { method: "POST", body: { open } });

// ===== BOT =====
export const getBotStatus = () => apiFetch(`/admin/bot/status`);
export const botStart = () => apiFetch(`/admin/bot/start`, { method: "POST" });
export const botStop  = () => apiFetch(`/admin/bot/stop`,  { method: "POST" });
export const botGoto  = (url) => apiFetch(`/admin/bot/goto`, { method: "POST", body: { url } });

export const getBotBearer = () => apiFetch(`/admin/bot/bearer`);
export const getBotCookies = () => apiFetch(`/admin/bot/cookies`);
export const botClearCookies = () => apiFetch(`/admin/bot/cookies/clear`, { method: "POST" });
export const getBotLocalStorage = () => apiFetch(`/admin/bot/localstorage`);
export const getBotConfig = () => apiFetch(`/admin/bot/config`);
export const setBotConfig = (payload) =>
  apiFetch(`/admin/bot/config`, { method: "POST", body: payload });
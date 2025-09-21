// src/api/dms.js
import { apiFetch } from "./client.js";

const API = {
  health: () => apiFetch("/health"),
  models: () => apiFetch("/api/models"),
  children: (subSeries, vin="") => apiFetch("/api/children", { method:"POST", body:{ subSeries, vin } }),
  structureGet: (code) => apiFetch(`/api/structure_get?code=${encodeURIComponent(code)}`),
  explosive: (code) => apiFetch(`/api/explosive?code=${encodeURIComponent(code)}`),
  technical: (code) => apiFetch(`/api/technical?code=${encodeURIComponent(code)}`),
  functionDesc: (code) => apiFetch(`/api/function_desc?code=${encodeURIComponent(code)}`),

  circuit: (code) => apiFetch(`/api/circuit?code=${encodeURIComponent(code)}`),
  circuitHot: (circuitId) => apiFetch(`/api/circuit_hot?circuitId=${encodeURIComponent(circuitId)}`),
  circuitClick: (payload) => apiFetch("/api/circuit_click", { method: "POST", body: payload }),

  destuffing: (code) => apiFetch(`/api/destuffing?code=${encodeURIComponent(code)}`),
  destuffingById: (destuffingId) => apiFetch(`/api/destuffing_by_id?destuffingId=${encodeURIComponent(destuffingId)}`),

  partDetail: (code) => apiFetch(`/api/part_detail?code=${encodeURIComponent(code)}`),
  procedure: (procedureId) => apiFetch(`/api/procedure?procedureId=${encodeURIComponent(procedureId)}`),
  materialList: (payload) => apiFetch("/api/material_list", { method: "POST", body: payload }),
  botGoto: (url) => apiFetch("/bot/goto", { method:"POST", body:{ url } }),
  botOpenNode: (payload) => apiFetch("/bot/open_node", { method:"POST", body: payload }),
};

export default API;
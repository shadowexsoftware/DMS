// src/pages/Viewer/utils/dataExtractors.js
export function getExplosivePayload(explResp) {
  const arr = Array.isArray(explResp?.data) ? explResp.data : explResp?.data?.data;
  if (!Array.isArray(arr) || !arr.length) return null;
  const f = arr.find(x => String(x.fileUrl || "").toLowerCase().endsWith(".svg")) || arr[0];
  return {
    url: f.fileUrl || "",
    svgContent: f.svgContent || "", // часто null — тогда берём по url
    hotspotToStructures: f.hotspotToStructures || {},
    hotspotHighlight: Array.isArray(f.hotspotHighlight) ? f.hotspotHighlight : [],
    resourceName: f.resourceName || "",
  };
}

export function extractHeader(structResp, fallbackItem) {
  const d = structResp?.data?.data ?? structResp?.data ?? {};
  return {
    name: d.materialName ?? fallbackItem.materialName ?? fallbackItem.structureName ?? "",
    materialCode: d.materialCode ?? fallbackItem.materialCode ?? "",
    manHour: d.manHour ?? fallbackItem.manHour ?? "",
    torque: d.torque ?? "",
    torqueDegree: d.torqueDegree ?? "",
  };
}

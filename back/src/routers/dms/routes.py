# src/routers/dms/routes.py
from __future__ import annotations
import logging
import time
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, request, jsonify
import httpx

from .services import (
    COMMON_HEADERS, ENDPOINTS, pack_httpx, get_bearer,
    _auth_headers, bearer_info
)

# если нужны прямые вызовы бота (не обязательно)
try:
    from src.bot.chehejia_bot import bot
except Exception:
    bot = None

bp = Blueprint("dms", __name__)  # без префикса: маршруты начинаются с /api и /bot
log = logging.getLogger("api")


# ----------------- helpers: safe logging -----------------

def _mask_token(tok: Optional[str], left: int = 8, right: int = 6) -> str:
    if not tok:
        return ""
    t = tok.strip()
    pref = ""
    if t.lower().startswith("bearer "):
        pref = "Bearer "
        t = t[7:].strip()
    if len(t) <= left + right:
        return pref + t
    return f"{pref}{t[:left]}...{t[-right:]}"


def _shrink(obj: Any, limit: int = 800) -> Any:
    """
    Обрезает большие строки для логов, чтобы не заспамить файлы.
    """
    try:
        s = obj if isinstance(obj, str) else repr(obj)
        if len(s) > limit:
            return s[:limit] + f"... <+{len(s)-limit}b>"
        return s
    except Exception:
        return obj


def _log_request(method: str, url: str,
                 headers: Optional[Dict[str, str]] = None,
                 params: Optional[Dict[str, Any]] = None,
                 json_body: Optional[Any] = None) -> Dict[str, Any]:
    h = dict(headers or {})
    # маскируем токен
    if "authorization" in h:
        h["authorization"] = _mask_token(h.get("authorization"))
    if "Authorization" in h:
        h["Authorization"] = _mask_token(h.get("Authorization"))
    log.debug("→ %s %s params=%s json=%s headers=%s",
              method.upper(), url, _shrink(params), _shrink(json_body), _shrink(h))
    return h


def _log_response(url: str, started: float, resp: httpx.Response) -> None:
    dt = (time.perf_counter() - started) * 1000.0
    ctype = (resp.headers.get("content-type") or "").lower()
    # стараемся не логировать огромные тела — только первые 1.5К
    body_preview = ""
    try:
        if "application/json" in ctype:
            body_preview = _shrink(resp.text, 1500)
        else:
            body_preview = _shrink(resp.text, 500)
    except Exception:
        body_preview = "<body read error>"
    log.debug("← %s %s %d %.1fms ctype=%s body=%s",
              resp.request.method, url, resp.status_code, dt, ctype, body_preview)


def _req(method: str, url: str, *,
         headers: Dict[str, str],
         params: Optional[Dict[str, Any]] = None,
         json: Optional[Any] = None,
         timeout: float = 20.0) -> httpx.Response:
    """
    Единая точка исходящих вызовов с логами запроса/ответа.
    """
    safe_headers = _log_request(method, url, headers, params, json)
    t0 = time.perf_counter()
    with httpx.Client(timeout=timeout) as cl:
        if method.upper() == "GET":
            r = cl.get(url, headers=headers, params=params)
        elif method.upper() == "POST":
            r = cl.post(url, headers=headers, params=params, json=json)
        else:
            r = cl.request(method.upper(), url, headers=headers, params=params, json=json)
    _log_response(url, t0, r)
    return r


# --- CORS preflight для любого /api/* (защитно) ---
@bp.route("/api/<path:_p>", methods=["OPTIONS"])
def api_preflight(_p):
    return ("", 204)


# --- HEALTH & BEARER DEBUG ---
@bp.get("/health")
def health():
    info = bearer_info()
    return jsonify({"ok": True, **info})

@bp.get("/api/bearer")
def api_bearer():
    return jsonify(bearer_info())

# Тестовый «безопасный» пинг под токеном: словари/энумы
@bp.get("/api/ping_enums")
def api_ping_enums():
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["ping_enums"], headers=headers, timeout=15.0)
    return pack_httpx(r)


# --------------- DMS API ---------------

@bp.get("/api/models")
def api_models():
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["catalog"], headers=headers, timeout=20.0)
    return pack_httpx(r)

@bp.post("/api/children")
def api_children():
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    js = request.get_json(silent=True) or {}
    sub = (js.get("subSeries") or "").strip()
    vin = (js.get("vin") or "").strip()
    if not sub:
        return jsonify({"ok": False, "error": "subSeries is required"}), 400
    hdrs = {**headers, "content-type": "application/json"}
    payload = {"vin": vin, "subSeries": sub}
    r = _req("POST", ENDPOINTS["children"], headers=hdrs, json=payload, timeout=40.0)
    return pack_httpx(r)

@bp.get("/api/destuffing")
def api_destuffing():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["destuffing"], headers=headers,
             params={"structureCode": code}, timeout=30.0)
    return pack_httpx(r)

@bp.get("/api/part_detail")
def api_part_detail():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["part_detail"], headers=headers,
             params={"structureCode": code}, timeout=20.0)
    return pack_httpx(r)

@bp.get("/api/circuit")
def api_circuit():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    hdrs = {**headers, "content-type": "application/json"}
    r = _req("POST", ENDPOINTS["circuit"], headers=hdrs,
             json={"structureCode": code}, timeout=30.0)
    return pack_httpx(r)

@bp.get("/api/structure_get")
def api_structure_get():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["structure_get"], headers=headers,
             params={"structureCode": code}, timeout=20.0)
    return pack_httpx(r)

@bp.get("/api/explosive")
def api_explosive():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["explosive"], headers=headers,
             params={"structureCode": code}, timeout=20.0)
    return pack_httpx(r)

@bp.get("/api/technical")
def api_technical():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["technical"], headers=headers,
             params={"structureCode": code}, timeout=20.0)
    return pack_httpx(r)

@bp.get("/api/function_desc")
def api_function_desc():
    code = (request.args.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]
    r = _req("GET", ENDPOINTS["function_desc"], headers=headers,
             params={"structureCode": code}, timeout=20.0)
    return pack_httpx(r)

@bp.get("/api/circuit_hot")
def api_circuit_hot():
    """
    Получить список хотспотов для конкретной электрической схемы.
    Проксирует на GET /circuit/query_hot_circuit_diagram?circuitId=...
    """
    circuit_id = (request.args.get("circuitId")
                  or request.args.get("id")
                  or request.args.get("code") or "").strip()
    if not circuit_id:
        return jsonify({"ok": False, "error": "circuitId is required"}), 400

    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]

    r = _req(
        "GET",
        ENDPOINTS["circuit_hot"],
        headers=headers,
        params={"circuitId": circuit_id},
        timeout=30.0,
    )
    return pack_httpx(r)


@bp.post("/api/circuit_click")
def api_circuit_click():
    """
    Интерактивный запрос по клику на элементе электрической схемы.
    Тело запроса пробрасываем как есть в POST /circuit/query_circuit_diagram.
    Ожидаемые поля (пример):
      {
        "structureCode": "STQ45QE3",
        "circuitResourceCode": "40J5TD00YT",
        "hotspotCode": "QT02",
        "wirResourceCode": null,
        "wirHotspotCode": null
      }
    """
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]

    payload = request.get_json(silent=True) or {}
    # Лёгкая валидация, чтобы не стрелять совсем пустым
    if not (payload.get("structureCode") or payload.get("circuitResourceCode") or payload.get("hotspotCode")):
        return jsonify({"ok": False, "error": "payload is missing required fields"}), 400

    hdrs = {**headers, "content-type": "application/json"}
    r = _req(
        "POST",
        ENDPOINTS["circuit"],
        headers=hdrs,
        json=payload,
        timeout=30.0,
    )
    return pack_httpx(r)

@bp.get("/api/procedure")
def api_procedure():
    """
    Проксирует на GET /destuffing/procedure?procedureId=...
    Пример: /api/procedure?procedureId=PD-2U1VI5WC
    """
    pid = (request.args.get("procedureId")
           or request.args.get("id")
           or request.args.get("code") or "").strip()
    if not pid:
        return jsonify({"ok": False, "error": "procedureId is required"}), 400

    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]

    r = _req(
        "GET",
        ENDPOINTS["procedure"],
        headers=headers,
        params={"procedureId": pid},
        timeout=30.0,
    )
    return pack_httpx(r)

@bp.get("/api/destuffing_by_id")
def api_destuffing_by_id():
    """
    Проксирует на GET /destuffing/by_destuffing_id?destuffingId=...
    Пример: /api/destuffing_by_id?destuffingId=19202639834763346
    """
    destuffing_id = (request.args.get("destuffingId")
                     or request.args.get("id")
                     or request.args.get("code") or "").strip()
    if not destuffing_id:
        return jsonify({"ok": False, "error": "destuffingId is required"}), 400

    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]

    r = _req(
        "GET",
        ENDPOINTS["destuffing_by_id"],
        headers=headers,
        params={"destuffingId": destuffing_id},
        timeout=30.0,
    )
    return pack_httpx(r)

@bp.route("/api/material_list", methods=["GET", "POST"])
def api_material_list():
    """
    Проксирует на POST /destuffing/material_list.
    Можно вызывать:
      - GET  /api/material_list?destuffingId=...&pageNo=1&pageSize=10&materialType=10
      - POST /api/material_list  с телом-оригиналом апи
        {"pageNo":1,"pageSize":10,"param":{"destuffingId":"...","bizCodeList":null,"materialType":10}}
    """
    headers, err = _auth_headers()
    if err:
        return jsonify(err[0]), err[1]

    if request.method == "GET":
        destuffing_id = (request.args.get("destuffingId") or request.args.get("id") or "").strip()
        if not destuffing_id:
            return jsonify({"ok": False, "error": "destuffingId is required"}), 400
        try:
            page_no = int(request.args.get("pageNo") or 1)
        except Exception:
            page_no = 1
        try:
            page_size = int(request.args.get("pageSize") or 10)
        except Exception:
            page_size = 10
        mtype_raw = request.args.get("materialType")
        material_type = None
        try:
            if mtype_raw is not None and str(mtype_raw).strip() != "":
                material_type = int(mtype_raw)
        except Exception:
            material_type = None

        payload = {
            "pageNo": page_no,
            "pageSize": page_size,
            "param": {
                "destuffingId": destuffing_id,
                "bizCodeList": None,
                "materialType": material_type if material_type is not None else 10,
            },
        }
    else:
        js = request.get_json(silent=True) or {}
        if {"pageNo", "pageSize", "param"} <= set(js.keys()):
            if not (js.get("param") or {}).get("destuffingId"):
                return jsonify({"ok": False, "error": "param.destuffingId is required"}), 400
            payload = js
        else:
            destuffing_id = (js.get("destuffingId") or js.get("id") or "").strip()
            if not destuffing_id:
                return jsonify({"ok": False, "error": "destuffingId is required"}), 400
            try:
                page_no = int(js.get("pageNo") or 1)
            except Exception:
                page_no = 1
            try:
                page_size = int(js.get("pageSize") or 10)
            except Exception:
                page_size = 10
            mtype = js.get("materialType")
            try:
                material_type = int(mtype) if mtype is not None else 10
            except Exception:
                material_type = 10
            payload = {
                "pageNo": page_no,
                "pageSize": page_size,
                "param": {
                    "destuffingId": destuffing_id,
                    "bizCodeList": js.get("bizCodeList"),
                    "materialType": material_type,
                },
            }

    hdrs = {**headers, "content-type": "application/json"}
    r = _req(
        "POST",
        ENDPOINTS["material_list"],
        headers=hdrs,
        json=payload,
        timeout=30.0,
    )
    return pack_httpx(r)

# --------------- БОТ (минимум) ---------------

@bp.post("/bot/goto")
def bot_goto():
    if bot is None:
        return jsonify({"ok": False, "error": "bot module not available"}), 500
    js = request.get_json(silent=True) or {}
    url = (js.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url is required"}), 400
    return jsonify(bot.goto(url, timeout=float(js.get("timeout", 10))))

@bp.post("/bot/reload")
def bot_reload():
    if bot is None:
        return jsonify({"ok": False, "error": "bot module not available"}), 500
    js = request.get_json(silent=True) or {}
    return jsonify(bot.reload(timeout=float(js.get("timeout", 10))))

@bp.post("/bot/click")
def bot_click():
    if bot is None:
        return jsonify({"ok": False, "error": "bot module not available"}), 500
    js = request.get_json(silent=True) or {}
    sel = js.get("selector")
    if not sel:
        return jsonify({"ok": False, "error": "selector is required"}), 400
    nth = int(js.get("nth", 0))
    return jsonify(bot.click(sel, nth=nth, timeout=float(js.get("timeout", 10))))

@bp.post("/bot/eval")
def bot_eval():
    if bot is None:
        return jsonify({"ok": False, "error": "bot module not available"}), 500
    js = request.get_json(silent=True) or {}
    script = js.get("script")
    if not script:
        return jsonify({"ok": False, "error": "script is required"}), 400
    return jsonify(bot.eval(script, timeout=float(js.get("timeout", 10))))

@bp.get("/bot/whereami")
def bot_whereami():
    if bot is None:
        return jsonify({"ok": False, "error": "bot module not available"}), 500
    r = bot.eval("location.href")
    return jsonify(r)

@bp.get("/bot/models")
def bot_models():
    # прокси на реальный /api/models
    return api_models()

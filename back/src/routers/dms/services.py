# src/routers/dms/services.py
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import base64
import json
import time

import httpx
from flask import jsonify
from config import settings

try:
    from src.bot.chehejia_bot import bot
except Exception:
    bot = None

TOKEN_FILE = Path(settings.OUT_DIR) / "token.json"

def _mask(tok: str, left: int = 6, right: int = 6) -> str:
    if not tok:
        return ""
    t = tok
    if t.lower().startswith("bearer "):
        t = t[7:].strip()
    if len(t) <= left + right:
        return t
    return f"{t[:left]}...{t[-right:]}"

def _jwt_exp_unix(bearer: Optional[str]) -> Optional[int]:
    if not bearer:
        return None
    tok = bearer.strip()
    if tok.lower().startswith("bearer "):
        tok = tok[7:].strip()
    try:
        _h, p, _sig = tok.split(".")
        p += "=" * ((4 - len(p) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(p).decode("utf-8") or "{}")
        exp = payload.get("exp")
        return int(exp) if exp is not None else None
    except Exception:
        return None

COMMON_HEADERS: Dict[str, str] = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "ru-RU",
    "origin": "https://fed-dms-web-prod-public-centralasia.chehejia.com",
    "referer": "https://fed-dms-web-prod-public-centralasia.chehejia.com/",
    "user-agent": "DMS-Viewer/1.0",
}

# === БАЗА и ЭНДПОИНТЫ ===
BASE = (getattr(settings, "DMS_API_BASE", "") or "").rstrip("/") or \
       "https://example.com"

# Рабочие пути (как в chehejia_server.py)
ENDPOINTS = {
    "catalog":       f"{BASE}/repair/structure_catalog",
    "children":      f"{BASE}/repair/structure_list_children",
    "structure_get": f"{BASE}/repair/structure_get",
    "explosive":     f"{BASE}/repair/explosive",
    "technical":     f"{BASE}/technical/by_structure_code",
    "function_desc": f"{BASE}/function_desc/by_structure_code",
    "circuit":       f"{BASE}/circuit/query_circuit_diagram",
    "circuit_hot":   f"{BASE}/circuit/query_hot_circuit_diagram",
    "destuffing":    f"{BASE}/destuffing/by_structure_code",
    "part_detail":   f"{BASE}/part/query_part_detail",
    "ping_enums":    f"{BASE}/dms-user/dict",
    "procedure":     f"{BASE}/destuffing/procedure",
    "destuffing_by_id": f"{BASE}/destuffing/by_destuffing_id",
    "material_list": f"{BASE}/destuffing/material_list",
}

def pack_httpx(resp: httpx.Response):
    """
    Пробрасываем status_code и тело как есть (json если возможно).
    """
    try:
        data = resp.json()
        return jsonify(data), resp.status_code
    except Exception:
        txt = resp.text
        return txt, resp.status_code, {"Content-Type": resp.headers.get("content-type", "text/plain")}

def get_bearer() -> Optional[str]:
    """
    1) спрашиваем у бота, если он есть и запущен
    2) читаем из out/token.json (если бот писал туда)
    Возвращаем строку вида 'Bearer <JWT>'.
    """
    # бот
    if bot is not None:
        try:
            b = bot.get_bearer()
            if b:
                return b
        except Exception:
            pass

    # файл
    try:
        if TOKEN_FILE.exists():
            js = json.loads(TOKEN_FILE.read_text("utf-8"))
            b = js.get("bearer") or js.get("token") or ""
            return b or None
    except Exception:
        pass
    return None

def bearer_info() -> Dict[str, Any]:
    b = get_bearer()
    exp = _jwt_exp_unix(b)
    ttl = (exp - time.time()) if exp else None
    return {
        "have_bearer": bool(b),
        "masked": _mask(b or ""),
        "exp": exp,
        "ttl_sec": ttl,
        "base": BASE,
    }

def _auth_headers() -> Tuple[Optional[Dict[str, str]], Optional[Tuple[dict, int]]]:
    b = get_bearer()
    if not b:
        return None, ({"ok": False, "error": "bearer not ready"}, 503)
    headers = {**COMMON_HEADERS, "authorization": b}
    return headers, None

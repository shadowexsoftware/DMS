# src/routers/auth/deps.py
from functools import wraps
from flask import request, jsonify
from sqlalchemy import select
from db import get_session
from src.models import User
from src.routers.auth.security import decode_jwt


def _extract_token() -> str | None:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1]


def current_user_or_401():
    token = _extract_token()
    if not token:
        return None, (jsonify({"ok": False, "error": "no token"}), 401)
    try:
        data = decode_jwt(token)
    except Exception:
        return None, (jsonify({"ok": False, "error": "invalid token"}), 401)

    sub = (data or {}).get("sub")
    if not sub:
        return None, (jsonify({"ok": False, "error": "invalid token payload"}), 401)

    with get_session() as s:
        u = s.scalar(select(User).where(User.id == int(sub)))
        if not u:
            return None, (jsonify({"ok": False, "error": "user not found"}), 401)
        return u, None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        u, err = current_user_or_401()
        if err:
            return err
        request.user = u
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        u, err = current_user_or_401()
        if err:
            return err
        if not u.is_admin:
            return jsonify({"ok": False, "error": "admin only"}), 403
        request.user = u
        return fn(*args, **kwargs)
    return wrapper
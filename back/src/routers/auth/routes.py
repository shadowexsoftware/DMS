# src/routers/auth/routes.py
from flask import Blueprint, request, jsonify
from sqlalchemy import select
from db import get_session
from src.models import User 
from src.routers.auth.security import (
    hash_password, verify_password, make_jwt, decode_jwt
)
from flask import current_app

import re


bp = Blueprint("auth", __name__, url_prefix="/auth")

def _valid_email(e: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", e))

@bp.post("/register")
def register():
    js = request.get_json(silent=True) or {}

    username = (js.get("username") or "").strip()
    email = (js.get("email") or "").strip().lower()
    password = js.get("password") or ""

    if not (current_app.config.get("REGISTRATION_OPEN", True)):
        return jsonify({"ok": False, "error": "registration disabled"}), 403

    if not username or not email or not password:
        return jsonify({"ok": False, "error": "username, email, password are required"}), 400
    if len(username) < 3:
        return jsonify({"ok": False, "error": "username too short"}), 400
    if len(password) < 8:
        return jsonify({"ok": False, "error": "password too short"}), 400
    if not _valid_email(email):
        return jsonify({"ok": False, "error": "email invalid"}), 400

    with get_session() as s:
        exists = s.scalar(
            select(User).where((User.username == username) | (User.email == email))
        )
        if exists:
            return jsonify({"ok": False, "error": "user already exists"}), 409

        u = User(username=username, email=email, password_hash=hash_password(password))
        s.add(u); s.commit(); s.refresh(u)

        token = make_jwt(str(u.id))
        return jsonify({"ok": True, "token": token, "user": {
            "id": u.id, "username": u.username, "email": u.email
        }})

@bp.post("/login")
def login():
    js = request.get_json(silent=True) or {}
    login = (js.get("login") or "").strip()
    password = js.get("password") or ""
    if not login or not password:
        return jsonify({"ok": False, "error": "missing creds"}), 400

    with get_session() as s:
        q = select(User).where((User.username == login) | (User.email == login.lower()))
        user = s.scalar(q)
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"ok": False, "error": "bad creds"}), 401
        if not user.is_active:
            return jsonify({"ok": False, "error": "user banned"}), 403
        token = make_jwt(str(user.id))
        return jsonify({"ok": True, "token": token, "user": {"id": user.id, "username": user.username, "email": user.email}})

@bp.get("/me")
def me():
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return jsonify({"ok": False, "error": "no token"}), 401
    token = auth.split(" ",1)[1]
    try:
        data = decode_jwt(token)
    except Exception:
        return jsonify({"ok": False, "error": "invalid token"}), 401
    with get_session() as s:
        from sqlalchemy import select
        from src.models import User
        u = s.scalar(select(User).where(User.id == int(data.get("sub"))))
        if not u:
            return jsonify({"ok": False, "error": "user not found"}), 401
        return jsonify({
            "ok": True,
            "user": {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "is_admin": u.is_admin,
                "is_active": u.is_active,
            }
        })
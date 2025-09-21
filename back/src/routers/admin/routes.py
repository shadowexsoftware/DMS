# src/routers/admin/routes.py
from flask import Blueprint, request, jsonify, current_app
from src.bot.chehejia_bot import bot
from flask import send_file
from src.routers.auth.deps import admin_required
from sqlalchemy import select
from db import get_session
from src.models import User

# NEW: модель конфига
from src.models.bot_config import BotConfig

bp = Blueprint("admin", __name__, url_prefix="/admin")

# ---------- helpers ----------
_DEFAULT_ACCESS_KEY = "@@idaasjs@@::1pVr4hOFvSwvPUfCyJ6FiT::access_token"
_DEFAULT_ID_KEY     = "@@idaasjs@@::default::id_token"

def _mask(s: str, left: int = 6, right: int = 6) -> str:
    if not s:
        return ""
    return s if len(s) <= left + right else f"{s[:left]}...{s[-right:]}"

def _ensure_bot_config(session) -> BotConfig:
    row = session.get(BotConfig, 1)
    if row:
        return row
    row = BotConfig(
        id=1,
        access_token_key=_DEFAULT_ACCESS_KEY,
        id_token_key=_DEFAULT_ID_KEY,
        access_token_json=None,
        id_token_json=None,
        sso_token=None,
    )
    session.add(row)
    session.commit()
    return row

# ---------- BOT controls (admin only) ----------
@bp.get("/bot/status")
@admin_required
def bot_status():
    if not bot.is_running():
        return jsonify({"ok": True, "running": False, "have_bearer": False})
    return jsonify(bot.status())

@bp.post("/bot/start")
@admin_required
def bot_start():
    if bot.is_running():
        return jsonify({"ok": True, "note": "already running"})
    bot.start()
    return jsonify({"ok": True})

@bp.post("/bot/stop")
@admin_required
def bot_stop():
    if not bot.is_running():
        return jsonify({"ok": True, "note": "already stopped"})
    bot.stop()
    return jsonify({"ok": True})

@bp.get("/bot/screenshot")
@admin_required
def bot_screenshot():
    try:
        path = bot.screenshot()
        return send_file(path, mimetype="image/png")
    except Exception as e:
        return jsonify({"ok": False, "error": repr(e)}), 500

@bp.post("/bot/goto")
@admin_required
def bot_goto():
    js = request.get_json(silent=True) or {}
    url = (js.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url required"}), 400
    if not bot.is_running():
        return jsonify({"ok": False, "error": "bot not running"}), 409
    return jsonify(bot.goto(url, timeout=15))

@bp.get("/bot/bearer")
@admin_required
def bot_bearer():
    b = bot.get_bearer() or ""
    masked = (b[:24] + "..." + b[-12:]) if b else ""
    return jsonify({"ok": True, "have": bool(b), "bearer_masked": masked})

@bp.get("/bot/cookies")
@admin_required
def bot_cookies():
    if not bot.is_running():
        return jsonify({"ok": False, "error": "bot not running"}), 409
    return jsonify(bot.cookies())

@bp.post("/bot/cookies/clear")
@admin_required
def bot_cookies_clear():
    if not bot.is_running():
        return jsonify({"ok": False, "error": "bot not running"}), 409
    return jsonify(bot.clear_cookies())

@bp.get("/bot/localstorage")
@admin_required
def bot_ls():
    if not bot.is_running():
        return jsonify({"ok": False, "error": "bot not running"}), 409
    # Всегда возвращаем полные значения без маскирования
    return jsonify(bot.localstorage(full=True))


# ---------- BOT config (admin only) ----------
@bp.get("/bot/config")
@admin_required
def bot_config_get():
    with get_session() as s:
        cfg = _ensure_bot_config(s)
        return jsonify({
            "ok": True,
            "access_token_key": cfg.access_token_key,
            "id_token_key": cfg.id_token_key,
            "has_access_token_json": bool(cfg.access_token_json),
            "has_id_token_json": bool(cfg.id_token_json),
            "has_sso_token": bool(cfg.sso_token),
            "sso_token_masked": _mask(cfg.sso_token) if cfg.sso_token else "",
        })

@bp.post("/bot/config")
@admin_required
def bot_config_set():
    """
    Семантика входа:
      - access_token_key / id_token_key: строка → записать; отсутствие ключа в JSON → не менять.
      - access_token_json / id_token_json / sso_token:
          * None (отсутствует в JSON) → не менять
          * "" (пустая строка)       → очистить в БД
          * "...."                   → записать в БД
      - apply_now (bool, default True) — применить к текущей сессии бота (localStorage/cookies)
      - reload_after (bool, default False) — перезагрузить страницу бота
    """
    js = request.get_json(silent=True) or {}

    with get_session() as s:
        cfg = _ensure_bot_config(s)

        # ключи LS
        if "access_token_key" in js:
            cfg.access_token_key = (js.get("access_token_key") or "").strip()
        if "id_token_key" in js:
            cfg.id_token_key = (js.get("id_token_key") or "").strip()

        # содержимое
        if "access_token_json" in js:
            v = js.get("access_token_json")
            cfg.access_token_json = (None if v == "" else v)
        if "id_token_json" in js:
            v = js.get("id_token_json")
            cfg.id_token_json = (None if v == "" else v)
        if "sso_token" in js:
            v = js.get("sso_token")
            cfg.sso_token = (None if v == "" else v)

        s.commit()

        # Применяем «на лету» к боту (если он запущен/страница есть)
        try:
            bot.update_config(
                access_token_key=js.get("access_token_key"),
                id_token_key=js.get("id_token_key"),
                access_token_json=js.get("access_token_json"),
                id_token_json=js.get("id_token_json"),
                sso_token=js.get("sso_token"),
                apply_now=bool(js.get("apply_now", True)),
                reload_after=bool(js.get("reload_after", False)),
                persist=False,  # истина в БД
            )
        except Exception:
            # не прерываем запрос, даже если бота нет/ошибка применения
            pass

        return jsonify({
            "ok": True,
            "access_token_key": cfg.access_token_key,
            "id_token_key": cfg.id_token_key,
            "has_access_token_json": bool(cfg.access_token_json),
            "has_id_token_json": bool(cfg.id_token_json),
            "has_sso_token": bool(cfg.sso_token),
            "sso_token_masked": _mask(cfg.sso_token) if cfg.sso_token else "",
        })

# ---------- Registration toggle ----------
@bp.get("/config/registration")
@admin_required
def get_registration_flag():
    return jsonify({"ok": True, "registration_open": bool(current_app.config.get("REGISTRATION_OPEN", True))})

@bp.post("/config/registration")
@admin_required
def set_registration_flag():
    js = request.get_json(silent=True) or {}
    value = js.get("open")
    if value is None:
        return jsonify({"ok": False, "error": "body: { open: true|false }"}), 400
    current_app.config["REGISTRATION_OPEN"] = bool(value)
    return jsonify({"ok": True, "registration_open": bool(value)})

# ---------- Users management ----------
@bp.get("/users")
@admin_required
def list_users():
    # simple pagination
    try:
        limit = max(1, min(100, int(request.args.get("limit", 50))))
        offset = max(0, int(request.args.get("offset", 0)))
    except ValueError:
        return jsonify({"ok": False, "error": "bad pagination"}), 400

    with get_session() as s:
        rows = s.scalars(select(User).order_by(User.id).offset(offset).limit(limit)).all()
        data = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "is_admin": u.is_admin,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in rows
        ]
        return jsonify({"ok": True, "items": data, "limit": limit, "offset": offset})

@bp.post("/users/<int:user_id>/ban")
@admin_required
def ban_user(user_id: int):
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            return jsonify({"ok": False, "error": "user not found"}), 404
        u.is_active = False
        s.commit()
        return jsonify({"ok": True, "user_id": u.id, "is_active": u.is_active})

@bp.post("/users/<int:user_id>/unban")
@admin_required
def unban_user(user_id: int):
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            return jsonify({"ok": False, "error": "user not found"}), 404
        u.is_active = True
        s.commit()
        return jsonify({"ok": True, "user_id": u.id, "is_active": u.is_active})

@bp.post("/users/<int:user_id>/promote")
@admin_required
def promote_admin(user_id: int):
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            return jsonify({"ok": False, "error": "user not found"}), 404
        u.is_admin = True
        s.commit()
        return jsonify({"ok": True, "user_id": u.id, "is_admin": u.is_admin})

@bp.post("/users/<int:user_id>/demote")
@admin_required
def demote_admin(user_id: int):
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            return jsonify({"ok": False, "error": "user not found"}), 404
        u.is_admin = False
        s.commit()
        return jsonify({"ok": True, "user_id": u.id, "is_admin": u.is_admin})

@bp.post("/users/create")
@admin_required
def create_user_admin():
    js = request.get_json(silent=True) or {}
    username = (js.get("username") or "").strip()
    email = (js.get("email") or "").strip().lower()
    password = (js.get("password") or "").strip()
    is_admin = bool(js.get("is_admin"))

    if not username or not email or not password:
        return jsonify({"ok": False, "error": "username, email, password required"}), 400

    # TODO: проверь дубликаты email/username
    from werkzeug.security import generate_password_hash
    pwd_hash = generate_password_hash(password)

    with get_session() as s:
        u = User(username=username, email=email, password_hash=pwd_hash, is_admin=is_admin, is_active=True)
        s.add(u)
        s.commit()
        return jsonify({"ok": True, "id": u.id, "username": u.username, "email": u.email, "is_admin": u.is_admin})

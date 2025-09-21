# src/bot/chehejia_bot.py
from __future__ import annotations

import base64
import datetime
import hashlib
import json
import time
import threading
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from queue import Queue, Empty

from playwright.sync_api import sync_playwright, Page
from sqlalchemy import create_engine, text

from config import settings

botlog = logging.getLogger("bot")

# --------- Пути / файлы состояния ---------
OUT = Path("out"); OUT.mkdir(exist_ok=True)
QUEUE = OUT / "queue";  QUEUE.mkdir(exist_ok=True)
RESULTS = OUT / "results"; RESULTS.mkdir(exist_ok=True)
TOKEN_FILE = OUT / "token.json"
STATUS_FILE = OUT / "status.json"

# --------- Настройки поведения ---------
USER_DATA_DIR   = settings.BOT_PROFILE_DIR
START_URL       = settings.BOT_START_URL
REPAIR_LIST_URL = getattr(settings, "BOT_REPAIR_LIST_URL", START_URL)

# как часто «пульсить» localStorage (сек)
LS_POLL_SEC          = float(getattr(settings, "BOT_LS_POLL_SEC", 2.5))
# «тихий» лимит логов: если токен в LS не меняется — писать не чаще, чем раз в N сек
LS_UNCHANGED_LOG_SEC = float(getattr(settings, "BOT_LS_UNCHANGED_LOG_SEC", 60.0))
# плановое обновление токена — принудительный reload страницы раз в N сек
REFRESH_EVERY_SEC    = float(getattr(settings, "BOT_REFRESH_EVERY_SEC", 60.0))
# сколько секунд после reload принимать «новый» токен (окно приёма)
ROTATE_WINDOW_SEC    = float(getattr(settings, "BOT_ROTATE_WINDOW_SEC", 30.0))

# --------- LocalStorage ключи (могут быть переопределены из БД) ---------
DEFAULT_ACCESS_TOKEN_KEY  = "@@idaasjs@@::1pVr4hOFvSwvPUfCyJ6FiT::access_token"
DEFAULT_ID_TOKEN_KEY      = "@@idaasjs@@::default::id_token"

# ============= Вспомогательные утилиты =============
def _mask(tok: str, left: int = 6, right: int = 6) -> str:
    if not tok:
        return ""
    t = tok.strip()
    if t.lower().startswith("bearer "):
        t = t[7:].strip()
    return t if len(t) <= left + right else f"{t[:left]}...{t[-right:]}"

def _jwt_exp_unix(bearer: Optional[str]) -> Optional[int]:
    """Возвращает exp (unix) из Bearer JWT без внешних зависимостей."""
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

def _short_sha(tok: str) -> str:
    if not tok:
        return ""
    t = tok.strip()
    return hashlib.sha256(t.encode("utf-8")).hexdigest()[:10]

def _save_json(path: Path, obj: Dict[str, Any]) -> None:
    try:
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

# ============= Класс бота =============
class ChehejiaBot:
    """
    Фоновый Playwright-бот, все действия с page/context — строго в бот-потоке.
    Внешний мир общается через очередь команд ._ask(…).
    """
    def __init__(self):
        self._th: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._ready = threading.Event()
        self._cmd_q: "Queue[Dict[str, Any]]" = Queue()
        self._page: Optional[Page] = None

        self._bearer: Optional[str] = None
        self._bearer_ts: float = 0.0
        self._bearer_source: str = ""
        self._have_initial_bearer: bool = False

        # окно приёма токена после планового reload
        self._rotate_window_until: float = 0.0
        self._last_refresh_ts: float = 0.0

        # антиспам по LS
        self._last_ls_hash: str = ""
        self._last_ls_log_ts: float = 0.0

        # антиспам по сети
        self._last_net_hash: str = ""
        self._last_net_log_ts: float = 0.0
        self._net_unchanged_log_sec: float = 60.0

        self._lock = threading.RLock()

        # Конфиг (могут прийти из БД)
        self._access_token_key = DEFAULT_ACCESS_TOKEN_KEY
        self._id_token_key     = DEFAULT_ID_TOKEN_KEY
        self._access_token_json = ""  # строка JSON или ""
        self._id_token_json     = ""  # строка JSON или ""
        self._sso_token         = ""  # значение cookie

        # Попробуем загрузить из БД
        try:
            engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)
            with engine.begin() as conn:
                row = conn.execute(text("""
                    SELECT access_token_key, id_token_key, access_token_json, id_token_json, sso_token
                    FROM bot_config WHERE id=1
                """)).mappings().first()
            if row:
                self._access_token_key = row["access_token_key"] or self._access_token_key
                self._id_token_key     = row["id_token_key"] or self._id_token_key
                self._access_token_json = row["access_token_json"] or ""
                self._id_token_json     = row["id_token_json"] or ""
                self._sso_token         = row["sso_token"] or ""
        except Exception:
            pass

    # ==================== Публичный API (без прямых вызовов page!) ====================

    def start(self):
        if self._th and self._th.is_alive():
            botlog.debug("start(): thread already alive")
            return
        self._stop.clear()
        self._th = threading.Thread(target=self._run, daemon=True, name="ChehejiaBot")
        self._th.start()
        ok = self._ready.wait(timeout=20.0)
        if not ok:
            botlog.warning("страница не успела подняться за 20с")

    def stop(self):
        self._stop.set()
        if self._th:
            self._th.join(timeout=5.0)
            botlog.info("bot thread joined")

    def is_running(self) -> bool:
        return bool(self._th and self._th.is_alive())

    def status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "ok": True,
                "running": self.is_running(),
                "have_bearer": bool(self._bearer),
                "bearer_source": self._bearer_source,
                "bearer_updated_ts": self._bearer_ts,
            }

    def screenshot(self, path: str = "out/last.png") -> str:
        # Выполним через команду, чтобы соблюсти поток
        res = self._ask({"op": "screenshot", "path": path}, timeout=30.0)
        if not res.get("ok"):
            raise RuntimeError(res.get("error") or "screenshot failed")
        return res.get("path", path)

    def goto(self, url: str, timeout: float = 50.0) -> Dict[str, Any]:
        return self._ask({"op": "goto", "url": url}, timeout)

    def reload(self, timeout: float = 50.0) -> Dict[str, Any]:
        return self._ask({"op": "reload"}, timeout)

    def click(self, selector: str, nth: int = 0, timeout: float = 30.0) -> Dict[str, Any]:
        return self._ask({"op": "click", "selector": selector, "nth": int(nth)}, timeout)

    def eval(self, script: str, timeout: float = 30.0) -> Dict[str, Any]:
        return self._ask({"op": "eval", "script": script}, timeout)

    def wait_response(self, url_substr: str, timeout_ms: int = 15000) -> Dict[str, Any]:
        if not url_substr:
            return {"ok": False, "error": "url_substr is required"}
        return self._ask(
            {"op": "wait_response", "url_substr": url_substr, "timeout_ms": int(timeout_ms)},
            (timeout_ms / 1000.0) + 1.0
        )

    def get_bearer(self) -> Optional[str]:
        with self._lock:
            return self._bearer

    def cookies(self) -> Dict[str, Any]:
        return self._ask({"op": "cookies"}, timeout=15.0)

    def clear_cookies(self) -> Dict[str, Any]:
        return self._ask({"op": "clear_cookies"}, timeout=15.0)

    def localstorage(self, full: bool = False) -> Dict[str, Any]:
        """
        Возвращает содержимое localStorage.
        full=False (по умолчанию) — значения маскируются.
        full=True — значения отдаются полностью (ОСТОРОЖНО: чувствительные данные).
        """
        return self._ask({"op": "localstorage", "full": bool(full)}, timeout=15.0)


    def update_config(
        self,
        *,
        access_token_key: str | None = None,
        id_token_key: str | None = None,
        access_token_json: str | None = None,  # "" → очистить; None → не менять
        id_token_json: str | None = None,      # "" → очистить; None → не менять
        sso_token: str | None = None,          # "" → очистить; None → не менять
        apply_now: bool = True,
        reload_after: bool = False,
        persist: bool = True,                  # файловое persist нам не нужно — оставлено для совместимости
    ) -> Dict[str, Any]:
        """
        ВНИМАНИЕ: никаких прямых touch к self._page здесь нет!
        Только обновление внутренних полей + команда 'apply_config' в бот-поток.
        """
        with self._lock:
            if access_token_key is not None:
                self._access_token_key = access_token_key.strip()
            if id_token_key is not None:
                self._id_token_key = id_token_key.strip()
            if access_token_json is not None:
                self._access_token_json = access_token_json  # может быть ""
            if id_token_json is not None:
                self._id_token_json = id_token_json
            if sso_token is not None:
                self._sso_token = sso_token

        if apply_now:
            self._ask({
                "op": "apply_config",
                "access_token_key": self._access_token_key,
                "acc_json_provided": (access_token_json is not None),
                "access_token_json": (self._access_token_json if access_token_json is not None else None),
                "id_token_key": self._id_token_key,
                "id_json_provided": (id_token_json is not None),
                "id_token_json": (self._id_token_json if id_token_json is not None else None),
                "sso_provided": (sso_token is not None),
                "sso_token": self._sso_token if sso_token is not None else None,
                "reload_after": bool(reload_after),
            }, timeout=30.0)

        # persist игнорируем (истина в БД)
        return self.get_config()

    def get_config(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "access_token_key": self._access_token_key,
                "id_token_key": self._id_token_key,
                "has_access_token_json": bool(self._access_token_json),
                "has_id_token_json": bool(self._id_token_json),
                "has_sso_token": bool(self._sso_token),
            }

    # ==================== Внутренняя кухня ====================

    def _ask(self, cmd: Dict[str, Any], timeout: float) -> Dict[str, Any]:
        done = threading.Event()
        box: Dict[str, Any] = {}
        self._cmd_q.put({"cmd": cmd, "done": done, "box": box})
        ok = done.wait(timeout=timeout)
        if not ok:
            botlog.warning("cmd=%s timeout after %.1fs", cmd.get("op"), timeout)
            return {"ok": False, "error": "bot timeout"}
        return box["res"]

    def _save_status(self, extra: Dict[str, Any] | None = None):
        with self._lock:
            st = {"ts": time.time(), "have_bearer": bool(self._bearer)}
        if extra:
            st.update(extra)
        _save_json(STATUS_FILE, st)

    def _accepting_rotation_now(self) -> bool:
        """Можно ли принимать новый токен сейчас?"""
        if not self._have_initial_bearer:
            return True  # первый токен ещё не приняли — можно
        return time.time() <= self._rotate_window_until  # окно после планового reload

    def _set_bearer(self, token: str, source: str):
        if not token:
            return
        # приём только в разрешённые моменты:
        if not self._accepting_rotation_now():
            return

        if not token.lower().startswith("bearer "):
            token = "Bearer " + token

        with self._lock:
            if token == self._bearer:
                return
            self._bearer = token
            self._bearer_ts = time.time()
            self._bearer_source = source
            self._have_initial_bearer = True  # первый принят — дальше только по окну ротации

        exp_unix = _jwt_exp_unix(token)
        ttl = (exp_unix - time.time()) if exp_unix else None
        exp_iso = datetime.datetime.utcfromtimestamp(exp_unix).isoformat() + "Z" if exp_unix else "n/a"

        botlog.info(
            "bearer обновлён из %s | hash=%s | len=%s | exp=%s | ttl=%.1fs | peek=%s",
            source,
            _short_sha(token),
            len(token),
            exp_iso,
            ttl if ttl is not None else -1.0,
            _mask(token)
        )

        _save_json(TOKEN_FILE, {
            "bearer": token,
            "hash": _short_sha(token),
            "masked": _mask(token),
            "len": len(token),
            "source": source,
            "ts": self._bearer_ts,
            "exp": exp_unix,
        })

        self._save_status()

    # --- перехват сети для Authorization: Bearer ---
    def _network_tap(self, req):
        try:
            if "api-boss-public-centralasia.chehejia.com" not in (req.url or ""):
                return
            auth = req.headers.get("authorization") or req.headers.get("Authorization")
            if not (auth and "bearer" in auth.lower()):
                return

            h = _short_sha(auth)
            now = time.time()
            changed = (h != self._last_net_hash)
            quiet_timeout = (now - self._last_net_log_ts) >= self._net_unchanged_log_sec

            if changed or quiet_timeout:
                botlog.debug(
                    "network_tap: Authorization %s, url=%s",
                    "updated" if changed else "unchanged",
                    req.url,
                )
                self._last_net_hash = h
                self._last_net_log_ts = now

            if changed:
                self._set_bearer(auth, "network")
        except Exception as e:
            botlog.debug("network_tap err: %r", e)

    # --- периодический опрос LS, со сдерживанием логов ---
    def _poll_localstorage_once(self):
        try:
            if self._page and not self._page.is_closed():
                # читаем access_token.raw из LS
                raw = self._page.evaluate(f"""
                    (() => {{
                      const s = localStorage.getItem("{self._access_token_key}");
                      if (!s) return null;
                      try {{
                        const js = JSON.parse(s);
                        return js?.body?.raw || null;
                      }} catch(_){{
                        return null;
                      }}
                    }})()
                """)
                if not isinstance(raw, str) or not raw:
                    return

                h = _short_sha(raw)
                now = time.time()
                changed = (h != self._last_ls_hash)
                quiet_timeout = (now - self._last_ls_log_ts) >= LS_UNCHANGED_LOG_SEC

                if changed or quiet_timeout:
                    botlog.debug(
                        "localStorage: access_token %s length=%s peek=%s",
                        "updated" if changed else "unchanged",
                        len(raw),
                        _mask(raw)
                    )
                    self._last_ls_hash = h
                    self._last_ls_log_ts = now

                if changed:
                    self._set_bearer(raw, "localStorage")
        except Exception as e:
            botlog.debug("poll_localstorage err: %r", e)

    def _plan_refresh_if_needed(self):
        """Раз в REFRESH_EVERY_SEC перезагружаем страницу и открываем окно приёма нового токена."""
        if not self._page or self._page.is_closed():
            return
        now = time.time()
        if (now - self._last_refresh_ts) < REFRESH_EVERY_SEC:
            return
        self._last_refresh_ts = now
        try:
            botlog.debug("planned refresh → reload()")
            self._rotate_window_until = now + ROTATE_WINDOW_SEC
            self._page.reload(wait_until="domcontentloaded")
        except Exception as e:
            botlog.warning("planned reload error: %r", e)

    # ==================== Основной поток бота ====================
    def _run(self):
        botlog.info("launching chromium (headless=%s) with profile %s",
                    bool(settings.BOT_HEADLESS), USER_DATA_DIR)
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(
                USER_DATA_DIR,
                headless=bool(settings.BOT_HEADLESS),
                args=["--disable-blink-features=AutomationControlled"],
            )

            try:
                ctx.set_default_navigation_timeout(45000)
                ctx.set_default_timeout(45000)
            except Exception:
                pass

            # Предзаполним LS/SSO из конфига при старте сессии (через init_script + cookie)
            if self._access_token_json or self._id_token_json:
                init_script = f"""
                (() => {{
                  try {{
                    {"localStorage.setItem('%s', `%s`);" % (self._access_token_key, self._access_token_json) if self._access_token_json != "" else ""}
                    {"localStorage.setItem('%s', `%s`);" % (self._id_token_key, self._id_token_json) if self._id_token_json != "" else ""}
                  }} catch(e){{ console.error('init LS error', e); }}
                }})();
                """
                ctx.add_init_script(init_script)

            if self._sso_token:
                try:
                    ctx.add_cookies([
                        {"name": "sso_token", "value": self._sso_token, "domain": "id.lixiang.com", "path": "/", "httpOnly": True, "secure": True, "sameSite": "None"},
                        {"name": "sso_token", "value": self._sso_token, "domain": "id.lixiang.com", "path": "/api", "httpOnly": True, "secure": True, "sameSite": "None"},
                    ])
                    botlog.info("SSO cookie injected at start")
                except Exception as e:
                    botlog.warning("sso add cookie err: %r", e)

            page = ctx.new_page()
            self._page = page
            page.on("request", self._network_tap)

            try:
                botlog.info("goto START_URL %s", START_URL)
                page.goto(START_URL, wait_until="domcontentloaded")
            except Exception as e:
                botlog.error("start goto err: %r", e)

            self._ready.set()
            self._save_status({"started": True})

            last_poll = 0.0

            try:
                while not self._stop.is_set():
                    # плановый refresh
                    self._plan_refresh_if_needed()

                    # опрос LS
                    if time.time() - last_poll > LS_POLL_SEC:
                        self._poll_localstorage_once()
                        last_poll = time.time()

                    # обработка команд
                    try:
                        item = self._cmd_q.get(timeout=0.15)
                    except Empty:
                        continue

                    cmd, done, box = item["cmd"], item["done"], item["box"]
                    op = cmd.get("op")
                    try:
                        if op == "goto":
                            url = (cmd.get("url") or "").strip()
                            if not url:
                                raise ValueError("url is required")
                            botlog.info("goto %s", url)
                            self._rotate_window_until = time.time() + ROTATE_WINDOW_SEC
                            page.goto(url, wait_until="domcontentloaded")
                            box["res"] = {"ok": True}

                        elif op == "reload":
                            botlog.info("reload()")
                            self._rotate_window_until = time.time() + ROTATE_WINDOW_SEC
                            page.reload(wait_until="domcontentloaded")
                            box["res"] = {"ok": True}

                        elif op == "click":
                            sel = cmd.get("selector")
                            nth = int(cmd.get("nth", 0))
                            if not sel:
                                raise ValueError("selector is required")
                            botlog.debug("click sel=%s nth=%s", sel, nth)
                            loc = page.locator(sel)
                            if nth:
                                loc = loc.nth(nth)
                            loc.click(timeout=5000)
                            box["res"] = {"ok": True}

                        elif op == "eval":
                            script = cmd.get("script")
                            if not script:
                                raise ValueError("script is required")
                            botlog.debug("eval script len=%s", len(script))
                            val = page.evaluate(script)
                            box["res"] = {"ok": True, "result": val}

                        elif op == "wait_response":
                            url_substr = (cmd.get("url_substr") or "").strip()
                            timeout_ms = int(cmd.get("timeout_ms") or 15000)
                            if not url_substr:
                                raise ValueError("url_substr is required")

                            botlog.debug("wait_response contains=%s timeout_ms=%s", url_substr, timeout_ms)
                            target = url_substr

                            def _predicate(resp):
                                try:
                                    return target in (resp.url or "")
                                except Exception:
                                    return False

                            try:
                                resp = page.wait_for_event("response", predicate=_predicate, timeout=timeout_ms)
                            except AttributeError:
                                resp = page.context.wait_for_event("response", predicate=_predicate, timeout=timeout_ms)

                            info: Dict[str, Any] = {
                                "ok": True,
                                "url": resp.url,
                                "status": resp.status,
                                "headers": dict(resp.headers or {}),
                            }

                            try:
                                ctype = (resp.headers.get("content-type") or "").lower()
                                if "application/json" in ctype:
                                    try:
                                        info["json"] = resp.json()
                                    except Exception:
                                        info["text"] = resp.text()
                                else:
                                    txt = resp.text()
                                    info["text"] = txt if len(txt) <= 200_000 else txt[:200_000]
                            except Exception as e:
                                info["body_error"] = repr(e)

                            box["res"] = info

                        elif op == "cookies":
                            try:
                                ck = page.context.cookies()
                                safe = [{"name": c.get("name"), "domain": c.get("domain"), "path": c.get("path")} for c in ck]
                                box["res"] = {"ok": True, "cookies": safe}
                            except Exception as e:
                                box["res"] = {"ok": False, "error": repr(e)}

                        elif op == "clear_cookies":
                            try:
                                page.context.clear_cookies()
                                botlog.info("cookies cleared")
                                box["res"] = {"ok": True}
                            except Exception as e:
                                box["res"] = {"ok": False, "error": repr(e)}

                        elif op == "localstorage":
                            try:
                                data = page.evaluate(
                                    "(()=>{let o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k)};return o})()"
                                )

                                if bool(cmd.get("full")):
                                    # Полные значения, без маскирования
                                    items = [{"key": k, "value": (data or {}).get(k)} for k in sorted((data or {}).keys())]
                                else:
                                    # Маскирование длинных строк (как раньше)
                                    masked = {
                                        k: (v[:24] + "..." + v[-12:] if isinstance(v, str) and len(v) > 40 else v)
                                        for k, v in (data or {}).items()
                                    }
                                    items = [{"key": k, "value": masked[k]} for k in sorted(masked.keys())]

                                box["res"] = {"ok": True, "items": items}
                            except Exception as e:
                                box["res"] = {"ok": False, "error": repr(e)}


                        elif op == "screenshot":
                            try:
                                path = cmd.get("path") or "out/last.png"
                                page.screenshot(path=path, full_page=True)
                                box["res"] = {"ok": True, "path": path}
                            except Exception as e:
                                box["res"] = {"ok": False, "error": repr(e)}

                        elif op == "apply_config":
                            # Применение конфига строго в бот-потоке
                            try:
                                accK = cmd.get("access_token_key")
                                idK  = cmd.get("id_token_key")
                                accProvided = bool(cmd.get("acc_json_provided"))
                                idProvided  = bool(cmd.get("id_json_provided"))
                                accVal = cmd.get("access_token_json")
                                idVal  = cmd.get("id_token_json")

                                # localStorage apply
                                page.evaluate(
                                    """(accK, accProvided, accVal, idK, idProvided, idVal) => {
                                      try {
                                        if (accK && accProvided) {
                                          if (accVal === "") localStorage.removeItem(accK);
                                          else localStorage.setItem(accK, accVal);
                                        }
                                        if (idK && idProvided) {
                                          if (idVal === "") localStorage.removeItem(idK);
                                          else localStorage.setItem(idK, idVal);
                                        }
                                      } catch(e){}
                                    }""",
                                    accK, accProvided, accVal, idK, idProvided, idVal
                                )

                                # SSO cookie apply (только установка; очистку лучше делать clear_cookies)
                                if bool(cmd.get("sso_provided")):
                                    sso = cmd.get("sso_token")
                                    if sso:
                                        page.context.add_cookies([
                                            {"name": "sso_token", "value": sso, "domain": "id.lixiang.com", "path": "/", "httpOnly": True, "secure": True, "sameSite": "None"},
                                            {"name": "sso_token", "value": sso, "domain": "id.lixiang.com", "path": "/api", "httpOnly": True, "secure": True, "sameSite": "None"},
                                        ])

                                if bool(cmd.get("reload_after")):
                                    self._rotate_window_until = time.time() + ROTATE_WINDOW_SEC
                                    page.reload(wait_until="domcontentloaded")

                                box["res"] = {"ok": True}
                            except Exception as e:
                                box["res"] = {"ok": False, "error": repr(e)}

                        else:
                            box["res"] = {"ok": False, "error": f"unknown op: {op}"}

                    except Exception as e:
                        botlog.exception("cmd error: %r", e)
                        box["res"] = {"ok": False, "error": repr(e)}
                    finally:
                        done.set()

            finally:
                self._save_status({"stopped": True})
                try:
                    ctx.close()
                except Exception:
                    pass
                botlog.info("context closed")

# Глобальный инстанс — импортируется сервером и админ-роутами
bot = ChehejiaBot()

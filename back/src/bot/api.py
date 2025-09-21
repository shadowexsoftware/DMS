# src/bot/api.py
from __future__ import annotations

import atexit
import base64
import json
import logging
import os
import threading
import time
from typing import Optional

from flask import Flask

from config import settings
from .chehejia_bot import bot

log = logging.getLogger("bot")  # отдельный логгер для бота

# Периодичность проверки и «ранняя» перезагрузка за SKEW_SEC до exp
SLEEP_SEC = int(getattr(settings, "BOT_CHECK_INTERVAL_SEC", 15))
SKEW_SEC  = int(getattr(settings, "BOT_SKEW_SEC", 60))


def _b64url_decode(s: str) -> bytes:
    s += "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def _jwt_exp(bearer: Optional[str]) -> Optional[int]:
    """Достаём число exp из Bearer JWT без внешних зависимостей."""
    if not bearer:
        return None
    tok = bearer.strip()
    if tok.lower().startswith("bearer "):
        tok = tok[7:].strip()
    try:
        _h, p, _sig = tok.split(".")
        payload = json.loads(_b64url_decode(p) or b"{}")
        exp = payload.get("exp")
        return int(exp) if exp is not None else None
    except Exception:
        return None


class BotManager:
    """Сторож, который держит бота живым и перезагружает страницу по exp."""
    def __init__(self):
        self._th: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def start_watchdog(self):
        if self._th and self._th.is_alive():
            return
        self._stop.clear()
        self._th = threading.Thread(target=self._loop, daemon=True, name="bot-watchdog")
        self._th.start()
        log.info("watchdog thread started")

    def stop_watchdog(self):
        self._stop.set()
        log.info("watchdog stop requested")

    def _loop(self):
        autostart = bool(getattr(settings, "BOT_AUTOSTART", True))
        while not self._stop.is_set():
            try:
                # 1) Держим процесс бота живым
                if autostart and not bot.is_running():
                    try:
                        log.info("starting bot… (headless=%s)", bool(settings.BOT_HEADLESS))
                        bot.start()
                        log.info("bot started")
                    except Exception as e:
                        log.exception("bot start error: %r", e)

                # 2) Следим за bearer и при необходимости обновляем страницу
                b = bot.get_bearer()
                exp = _jwt_exp(b)
                now = time.time()
                if exp is None:
                    if bot.is_running():
                        log.info("no bearer → goto START_URL")
                        try:
                            bot.goto(settings.BOT_START_URL)
                        except Exception as e:
                            log.exception("goto start error: %r", e)
                else:
                    ttl = exp - now
                    log.debug("bearer ttl = %.1fs", ttl)
                    if ttl <= SKEW_SEC and bot.is_running():
                        log.warning("bearer expiring (<= %ss) → reload()", SKEW_SEC)
                        try:
                            bot.reload(timeout=50.0)
                        except Exception as e:
                            log.exception("reload error: %r", e)

            except Exception as e:
                log.exception("watchdog loop error: %r", e)

            # Сон по 1 секунде, чтобы быстро реагировать на остановку
            for _ in range(SLEEP_SEC):
                if self._stop.is_set():
                    break
                time.sleep(1)


manager = BotManager()


def init_bot(app: Flask):
    """
    Интеграция с Flask 3.x:
      - Запускаем бота и сторожевой поток СРАЗУ при старте приложения,
        избегая двойного старта под dev-reloader’ом.
      - Доп. страховка: если по какой-то причине не стартанули сразу,
        первый HTTP-запрос запустит.
      - Корректная остановка через atexit.
    """
    started = {"flag": False}

    def _should_start_now() -> bool:
        # В продакшене reloader’а нет — стартуем сразу.
        if not app.debug:
            return True
        # В дев-режиме нужно стартовать только в «дочернем» процессе reloader’а.
        return os.environ.get("WERKZEUG_RUN_MAIN") == "true"

    def _ensure_started():
        if started["flag"]:
            return
        started["flag"] = True

        if bool(getattr(settings, "BOT_AUTOSTART", True)):
            try:
                log.info("init_bot: starting bot (immediate)")
                bot.start()
                log.info("init_bot: bot started")
            except Exception as e:
                log.exception("init_bot: bot.start error: %r", e)

        manager.start_watchdog()
        log.info("init_bot: bot watchdog started")

    # 1) Пытаемся стартовать сразу
    if _should_start_now():
        log.info("init_bot: starting immediately (debug=%s)", app.debug)
        _ensure_started()
    else:
        log.info("init_bot: parent reloader process — defer start")

    # 2) Страховка — если сразу не стартанули, запустим на первом запросе
    @app.before_request
    def _kickoff_once():
        if not started["flag"] and _should_start_now():
            log.info("init_bot: kickoff on first request")
            _ensure_started()

    # 3) Корректная остановка при завершении процесса
    def _shutdown():
        try:
            manager.stop_watchdog()
        except Exception:
            pass
        try:
            bot.stop()
        except Exception:
            pass
        log.info("bot watchdog stopped")

    atexit.register(_shutdown)

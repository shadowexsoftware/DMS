# scripts/create_admin.py
#!/usr/bin/env python3
"""
Создание или повышение админ-аккаунта.

Примеры:
  python scripts/create_admin.py --username boss --email admin@example.com --password 'S3cret!'
  python scripts/create_admin.py -u boss -e admin@example.com  # пароль спросит интерактивно
  python scripts/create_admin.py -u user1 -e user1@ex.com --promote
  python scripts/create_admin.py -u user1 -e user1@ex.com --promote --set-password 'NewPass123'
"""

import sys
import os
import argparse
import getpass

# === Готовим PYTHONPATH, чтобы импорт прошёл как при обычном запуске приложения ===
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from sqlalchemy import select, or_  # type: ignore
from werkzeug.security import generate_password_hash  # type: ignore

from app import create_app  # из вашего app.py
from db import get_session
from src.models import User


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Create or promote an admin user")
    p.add_argument("-u", "--username", required=True, help="Username")
    p.add_argument("-e", "--email", required=True, help="Email")
    p.add_argument("-p", "--password", help="Password (если не указать — спросит интерактивно)")
    p.add_argument("--promote", action="store_true", help="Если пользователь уже существует — сделать админом")
    p.add_argument("--set-password", dest="set_password", help="Обновить пароль существующему пользователю (используется с --promote)")
    p.add_argument("--inactive", action="store_true", help="Создать неактивным (по умолчанию активный)")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    # Пароль: берём из --password, иначе спросим, если создаём нового
    password = args.password
    if not password and not args.promote:
        pw1 = getpass.getpass("Введите пароль: ")
        pw2 = getpass.getpass("Повторите пароль: ")
        if pw1 != pw2:
            print("Ошибка: пароли не совпадают", file=sys.stderr)
            return 2
        password = pw1

    # Инициализируем приложение и контекст
    app = create_app()
    with app.app_context():
        with get_session() as s:
            # Ищем по username или email
            existing: User | None = s.scalar(
                select(User).where(
                    or_(User.username == args.username, User.email == args.email.lower())
                )
            )

            if existing:
                # Пользователь уже есть
                print(f"Найден пользователь id={existing.id} username={existing.username} email={existing.email}")
                if args.promote:
                    changed = False
                    if not existing.is_admin:
                        existing.is_admin = True
                        changed = True
                        print(" → Выдана роль admin")
                    if args.set_password:
                        existing.password_hash = generate_password_hash(args.set_password)
                        changed = True
                        print(" → Пароль обновлён")
                    if not existing.is_active:
                        existing.is_active = True
                        changed = True
                        print(" → Аккаунт активирован")
                    if not changed:
                        print("Изменений нет (уже admin, пароль не задан для смены).")
                    # commit произойдёт в get_session()
                    print("Готово.")
                    return 0
                else:
                    print("Ошибка: пользователь уже существует. Используйте --promote для повышения.", file=sys.stderr)
                    return 1

            # Создаём нового
            if not password:
                print("Ошибка: для нового пользователя обязателен пароль (или укажите --password).", file=sys.stderr)
                return 2

            u = User(
                username=args.username,
                email=args.email.lower(),
                is_admin=True,
                is_active=not args.inactive,
                password_hash=generate_password_hash(password),
            )
            s.add(u)
            # commit в get_session()
            print(f"Создан админ: id будет присвоен при коммите. Username={u.username} Email={u.email} Active={u.is_active}")
            print("Готово.")
            return 0


if __name__ == "__main__":
    raise SystemExit(main())

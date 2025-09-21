# src/bot/runner.py
from __future__ import annotations
import time
from .chehejia_bot import bot, START_URL

def main():
    print("[runner] starting bot…")
    bot.start()
    print("[runner] goto START_URL…")
    bot.goto(START_URL)
    try:
        while True:
            st = bot.status()
            print("[runner] status:", st)
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n[runner] stopping…")
        bot.stop()

if __name__ == "__main__":
    main()

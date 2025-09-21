#!/usr/bin/env bash
set -euo pipefail

# ==== Настройки ====
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$APP_DIR/.venv"                 # путь к venv (если не используете — оставьте пустым)
SCREEN_NAME="dms_backend"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/gunicorn.log"

# ENV для приложения
export APP_ENV=production
export DEBUG=false
export HOST=0.0.0.0
export PORT=5015

# Команда gunicorn (правьте по вкусу)
GUNICORN_CMD="gunicorn -w 1 -k gthread --threads 8 \
  --timeout 120 --graceful-timeout 30 \
  --access-logfile - --error-logfile - \
  -b 0.0.0.0:5015 app:app"

# ==== Функции ====
ensure_screen() {
  if ! command -v screen >/dev/null 2>&1; then
    echo "screen не установлен. Установите: sudo apt-get install -y screen"
    exit 1
  fi
}

ensure_logs() {
  mkdir -p "$LOG_DIR"
  touch "$LOG_FILE"
}

is_running() {
  screen -list | grep -q "[.]${SCREEN_NAME}[[:space:]]"
}

start() {
  ensure_screen
  ensure_logs

  if is_running; then
    echo "Уже запущено (screen: $SCREEN_NAME). Используйте ./server.sh attach"
    exit 0
  fi

  # собираем команду запуска
  local run_cmd="cd \"$APP_DIR\";"
  if [[ -n "${VENV:-}" && -f \"$VENV/bin/activate\" ]]; then
    run_cmd+=" source \"$VENV/bin/activate\";"
  fi
  run_cmd+=" exec $GUNICORN_CMD 2>&1 | tee -a \"$LOG_FILE\""

  # запускаем в detached screen
  screen -S "$SCREEN_NAME" -dm bash -lc "$run_cmd"

  sleep 0.5
  if is_running; then
    echo "Запущено в screen-сессии: $SCREEN_NAME"
    echo "Логи: $LOG_FILE"
    echo "Подключиться: ./server.sh attach"
  else
    echo "Не удалось запустить. Смотрите логи: $LOG_FILE"
    exit 1
  fi
}

stop() {
  if ! is_running; then
    echo "Не запущено."
    exit 0
  fi
  # отправим Ctrl+C в screen, затем закроем сессию
  screen -S "$SCREEN_NAME" -X stuff $'\003'
  sleep 1
  screen -S "$SCREEN_NAME" -X quit || true
  echo "Остановлено."
}

restart() {
  stop || true
  start
}

status() {
  if is_running; then
    echo "Статус: запущено (screen: $SCREEN_NAME)"
  else
    echo "Статус: не запущено"
  fi
}

attach() {
  ensure_screen
  if ! is_running; then
    echo "Сессия не найдена. Запустите: ./server.sh start"
    exit 1
  fi
  # присоединяемся к логам/процессу
  exec screen -r "$SCREEN_NAME"
}

tail_logs() {
  ensure_logs
  exec tail -n 200 -F "$LOG_FILE"
}

# ==== Разбор команды ====
CMD="${1:-}"
case "$CMD" in
  start)   start ;;
  stop)    stop ;;
  restart) restart ;;
  status)  status ;;
  attach)  attach ;;
  tail)    tail_logs ;;
  *)
    echo "Использование: $0 {start|stop|restart|status|attach|tail}"
    exit 1
    ;;
esac

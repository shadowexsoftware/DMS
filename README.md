# 1. Создаём виртуальное окружение
python3 -m venv .venv
source .venv/bin/activate

или

. .venv/bin/activate

python -m pip install -U pip wheel

# 2. Ставим пакеты 

pip install -r requirements.txt


# 3. Готовим Postgres (один раз)
sudo apt update
sudo apt install -y postgresql postgresql-client

# 2) проверим что сервис жив
sudo systemctl status postgresql
# при необходимости:
# sudo systemctl enable --now postgresql

# 3) заходим в psql от системного пользователя postgres
sudo -u postgres psql

-- создаём юзера и БД
CREATE USER dms WITH PASSWORD 'dms';
CREATE DATABASE dms_db OWNER dms;

-- даём базовые права (на всякий)
GRANT ALL PRIVILEGES ON DATABASE dms_db TO dms;
\q




# вход в бд
psql -h localhost -U dms -d dms_db 

проверка SHOW max_connections;

# 4. .env в корне репозитория
# -------------------------------------------
#ГЕНЕРАЦИЯ СЕКРЕТОВ python -c "import secrets, base64; print(secrets.token_hex(32))"

DATABASE_URL=postgresql+psycopg2://dms:dms@localhost:5432/dms_db
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
OUT_DIR=out
SNAPSHOT_DIR=out/snapshots
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000
APP_ENV=development
BOT_HEADLESS=1
DMS_API_BASE=
REGISTRATION_OPEN=true
DEBUG=false
LOG_LEVEL=INFO

# создаём .env
cat << EOF > .env
DATABASE_URL=postgresql+psycopg2://dms:dms@localhost:5432/dms_db
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
OUT_DIR=out
SNAPSHOT_DIR=out/snapshots
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000
APP_ENV=development
BOT_HEADLESS=1
DMS_API_BASE=
REGISTRATION_OPEN=true
DEBUG=false
LOG_LEVEL=INFO
EOF

# -------------------------------------------

# 5. Миграции БД

alembic revision --autogenerate -m "init"
alembic upgrade head

# создание админа
python scripts/create_admin.py


sudo mkdir -p /var/run/prom-multiproc/{twitch,wtv,kick}
sudo chown -R "$USER":"$USER" /var/run/prom-multiproc


# запуск основного апи
# один раз
sudo apt-get install -y screen



chmod +x server.sh

# старт
./server.sh start

# посмотреть статус
./server.sh status

# подключиться к живому процессу (логи в реальном времени)
./server.sh attach
# выйти из screen, не останавливая сервер: Ctrl+A, затем D

# просто «хвост» логов без screen
./server.sh tail

# остановка
./server.sh stop

# перезапуск
./server.sh restart


либо

gunicorn -w 1 -k gthread --threads 8 -b 0.0.0.0:5015 app:app

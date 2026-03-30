#!/usr/bin/env bash
# Развёртывание на Ubuntu 24.04 без Docker (только root).
#
# 1) Склонируйте репозиторий на сервер (или скопируйте файлы).
# 2) Из корня репозитория:
#      sudo bash scripts/deploy-vps.sh
#
# Другой репозиторий:
#      sudo REPO_URL="https://github.com/USER/REPO.git" bash scripts/deploy-vps.sh
#
# После первого запуска:
#      sudo nano /etc/sharescription.env
#      sudo systemctl restart sharescription

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/sflaer/sharescriptiontest.git}"
APP_USER="sharescription"
APP_DIR="/opt/sharescription"
DATA_DIR="/var/lib/sharescription"
ENV_FILE="/etc/sharescription.env"

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Запустите от root: sudo bash scripts/deploy-vps.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git gnupg

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//;s/\..*//')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node -v)  npm: $(npm -v)"

if ! id -u "$APP_USER" &>/dev/null; then
  useradd --system --shell /usr/sbin/nologin "$APP_USER"
fi

# Git 2.35+: иначе «detected dubious ownership» при chown репозитория на sharescription
if ! git config --system --get-all safe.directory 2>/dev/null | grep -qxF "$APP_DIR"; then
  git config --system --add safe.directory "$APP_DIR"
fi

mkdir -p "$DATA_DIR"
chown "$APP_USER:$APP_USER" "$DATA_DIR"
mkdir -p /opt
chown root:root /opt

if [[ -d "$APP_DIR/.git" ]]; then
  echo "Обновление $APP_DIR (git pull от root, затем chown)..."
  # Ручной git pull под root мог оставить .git с владельцем root — sharescription тогда не пишет в FETCH_HEAD
  git -C "$APP_DIR" pull --ff-only || {
    echo "pull не удался, пробуем origin/main..."
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" reset --hard origin/main
  }
elif [[ -d "$APP_DIR" ]]; then
  echo "Каталог $APP_DIR есть, но не git-репозиторий. Удалите его вручную или клонируйте в другое место."
  exit 1
else
  echo "Клонирование в $APP_DIR ..."
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Не используем NODE_ENV=production при установке — нужны devDependencies (tsx, prisma CLI).
echo "npm ci ..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
BOT_TOKEN=
WEB_APP_URL=https://ваш-фронт.vercel.app
MENU_BUTTON_TEXT=Подписки
DATABASE_URL=file:${DATA_DIR}/prod.db
PORT=3001
NODE_ENV=production
EOF
  chmod 600 "$ENV_FILE"
  echo "Создан $ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma migrate deploy"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma db seed" || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$SCRIPT_DIR/sharescription.service" ]]; then
  echo "Не найден $SCRIPT_DIR/sharescription.service (запускайте скрипт из клона репозитория)."
  exit 1
fi
install -m 0644 "$SCRIPT_DIR/sharescription.service" /etc/systemd/system/sharescription.service
systemctl daemon-reload
systemctl enable sharescription

if [[ -z "${BOT_TOKEN:-}" ]] || [[ "$BOT_TOKEN" == "your_token_here" ]]; then
  echo ""
  echo ">>> Укажите BOT_TOKEN в $ENV_FILE, затем: sudo systemctl restart sharescription"
else
  systemctl restart sharescription
  sleep 2
  systemctl --no-pager -l status sharescription || true
fi

echo ""
echo "Готово."
echo "- Редактировать секреты: sudo nano $ENV_FILE"
echo "- Статус:  sudo systemctl status sharescription"
echo "- Логи:    sudo journalctl -u sharescription -f"
echo "- Health:  curl -s http://127.0.0.1:3001/api/health"
echo "- Фаервол: sudo ufw allow OpenSSH && sudo ufw allow 3001/tcp && sudo ufw enable"
echo ""
echo "Vercel (фронт): VITE_API_URL=http://ВАШ_ПУБЛИЧНЫЙ_IP:3001"
echo "Для Mini App лучше HTTPS: nginx + Let's Encrypt на поддомен api."

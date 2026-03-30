# Пошаговая инструкция: бэкенд на VPS (Ubuntu 24.04)

Подходит для REG.Cloud и любого другого VPS с Ubuntu 24.04 LTS. Без Docker: Node.js, systemd, SQLite.

---

## Что вам понадобится заранее

1. **IP-адрес сервера** и доступ по **SSH** (логин `root` или пользователь с `sudo`).
2. Рекомендуется **SSH-ключ**; пароль — только если провайдер так выдал.
3. Токен бота: **`BOT_TOKEN`** от [@BotFather](https://t.me/BotFather).
4. HTTPS-адрес Mini App: **`WEB_APP_URL`** (например фронт на Vercel).
5. Репозиторий с кодом (по умолчанию в скрипте):  
   `https://github.com/sflaer/sharescriptiontest.git`  
   Если форк — укажете свой URL при деплое (см. шаг 4).

---

## Шаг 1. Подключение по SSH

На своём ПК (PowerShell, Terminal):

```bash
ssh root@ВАШ_IP
```

Подставьте **ваш** IP. Если порт SSH не 22 — укажите его:

```bash
ssh -p ПОРТ root@ВАШ_IP
```

При первом входе подтвердите отпечаток ключа (`yes`).

---

## Шаг 2. Обновить пакеты и поставить git

На сервере:

```bash
apt update
apt install -y git ca-certificates curl
```

---

## Шаг 3. Клонировать репозиторий

```bash
git clone https://github.com/sflaer/sharescriptiontest.git /opt/sharescription
cd /opt/sharescription
```

Если используете **свой** fork, замените URL в команде `git clone`.

---

## Шаг 4. Запустить скрипт развёртывания

Только от **root** (если вы под пользователем с sudo — добавьте `sudo`):

```bash
bash scripts/deploy-vps.sh
```

Скрипт:

- ставит **Node.js 22**;
- создаёт пользователя системы `sharescription`;
- готовит каталог данных **`/var/lib/sharescription`** для SQLite;
- выполняет **`npm ci`**, миграции Prisma, сид категорий;
- ставит сервис **systemd**: `sharescription`.

**Другой репозиторий без правки скрипта:**

```bash
REPO_URL="https://github.com/ВЫ/РЕПО.git" bash scripts/deploy-vps.sh
```

(Имеет смысл, если каталог `/opt/sharescription` ещё пуст и скрипт сам клонирует; если уже склонировали вручную — можно не задавать `REPO_URL`.)

При первом запуске создаётся файл **`/etc/sharescription.env`**. Если **`BOT_TOKEN`** в нём пустой, сервис **не стартует** до шага 5 — это нормально.

---

## Шаг 5. Настроить секреты и URL

Откройте файл окружения:

```bash
nano /etc/sharescription.env
```

Заполните минимум:

| Переменная       | Пример / пояснение |
|------------------|---------------------|
| `BOT_TOKEN`      | Токен от BotFather |
| `WEB_APP_URL`    | `https://xxx.vercel.app` — URL Mini App |
| `DATABASE_URL`   | Обычно уже `file:/var/lib/sharescription/prod.db` — не меняйте без причины |
| `PORT`           | `3001` — порт API |
| `MENU_BUTTON_TEXT` | По желанию, например `Подписки` |

Сохраните: **Ctrl+O**, Enter, выход: **Ctrl+X**.

Перезапустите сервис:

```bash
systemctl restart sharescription
systemctl status sharescription
```

Должно быть **active (running)**. Логи:

```bash
journalctl -u sharescription -f
```
(выход: **Ctrl+C**)

---

## Шаг 6. Фаервол (рекомендуется)

Если используете **ufw**, **сначала** разрешите SSH (иначе можно потерять доступ):

```bash
ufw allow OpenSSH
ufw allow 3001/tcp
ufw enable
ufw status
```

Порт **3001** — тот же, что в `PORT` в `/etc/sharescription.env`.

---

## Шаг 7. Проверить API

На сервере:

```bash
curl -s http://127.0.0.1:3001/api/health
```

Ожидаемый ответ: `{"ok":true}`.

С вашего ПК (подставьте публичный IP):

```bash
curl -s http://ВАШ_IP:3001/api/health
```

Если не открывается — проверьте **ufw** и правила облака REG (security groups / «сеть»), что входящий **TCP 3001** разрешён.

---

## Шаг 8. Фронт (Vercel) и `VITE_API_URL`

В **настройках проекта** фронта на Vercel → **Environment Variables**:

- Имя: **`VITE_API_URL`**
- Значение: **`http://ВАШ_IP:3001`** (или `https://…` после настройки домена и nginx, см. ниже)
- Без слэша в конце URL.

Сделайте **Redeploy** проекта, чтобы переменная попала в сборку.

**Mini App в Telegram** требует **HTTPS** у страницы и у API с точки зрения политики браузера/клиента. Для продакшена лучше:

- повесить **домен** на API;
- поставить **nginx** + **Let’s Encrypt**;
- тогда **`VITE_API_URL=https://api.ваш-домен`**.

Пока домена нет, для отладки часто используют туннели (ngrok и т.п.) — отдельная настройка.

---

## Обновление кода после изменений в Git

На сервере:

```bash
cd /opt/sharescription
git pull
bash scripts/deploy-vps.sh
```

Либо вручную от пользователя `sharescription`: `git pull`, `npm ci`, `systemctl restart sharescription` — скрипт проще повторить целиком.

---

## Частые проблемы

| Симптом | Что проверить |
|---------|----------------|
| `fatal: detected dubious ownership in repository` | Один раз от root: `git config --system --add safe.directory /opt/sharescription` затем снова `bash scripts/deploy-vps.sh`. В новых версиях скрипта это делается автоматически. |
| `cannot open '.git/FETCH_HEAD': Permission denied` | Часть `.git` владела root после ручного `git pull`. Выполните: `chown -R sharescription:sharescription /opt/sharescription`, обновите скрипт (`git pull`), снова `bash scripts/deploy-vps.sh`. В актуальном скрипте `git pull` выполняется от root. |
| `EACCES` на `mkdir '/home/sharescription'`, сломанный `node_modules` | У пользователя не было HOME. Выполните: `mkdir -p /home/sharescription && chown sharescription:sharescription /home/sharescription`, затем `rm -rf /opt/sharescription/node_modules`, `git pull`, снова `bash scripts/deploy-vps.sh`. В новых версиях скрипта это делается автоматически. |
| Prisma `P1012` / `Environment variable not found: DATABASE_URL` | `sudo` не передаёт переменные в `npx prisma`. В `/etc/sharescription.env` должна быть строка `DATABASE_URL=file:/var/lib/sharescription/prod.db`. Обновите скрипт (`git pull`) и снова `bash scripts/deploy-vps.sh` — в новых версиях `DATABASE_URL` передаётся явно. |
| `systemctl status` — failed | `journalctl -u sharescription -n 80` |
| Пустой / неверный `BOT_TOKEN` | `/etc/sharescription.env`, перезапуск сервиса |
| `curl` снаружи не работает | ufw, облачный фаервол, верный ли IP и порт |
| Ошибки Prisma / БД | `DATABASE_URL`, права на `/var/lib/sharescription`, место на диске |
| На фронте «HTML вместо JSON» | Не задан или неверный **`VITE_API_URL`**, фронт не пересобран |

---

## Краткий чеклист

- [ ] SSH на сервер  
- [ ] `apt install git curl ca-certificates`  
- [ ] `git clone … /opt/sharescription`  
- [ ] `bash scripts/deploy-vps.sh`  
- [ ] Заполнить `/etc/sharescription.env`, `systemctl restart sharescription`  
- [ ] `ufw`: SSH + 3001  
- [ ] `curl …/api/health`  
- [ ] Vercel: `VITE_API_URL`, redeploy  

Готово.

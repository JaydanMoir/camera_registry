# Развёртывание демо «Единый реестр камер» (общие данные в PostgreSQL)

Состав: приложение на Node.js (страница прототипа + API общего состояния) и PostgreSQL. Приложение слушает порт **3000**.

- Все, кто открывает адрес, работают с **одними данными**: заявление, поданное владельцем, через пару секунд видит ДРБ на другом компьютере.
- Роль, демо-организация и незаконченный черновик заявления у каждого свои (хранятся в браузере).
- «Сбросить демо-данные» сбрасывает данные **для всех**.
- Если двое изменили данные одновременно, второй получит сообщение «данные изменил другой участник», экран обновится, действие нужно повторить.
- Без сервера (claude.ai, GitHub, файл с диска) страница работает как раньше — данные в браузере.

| Путь | Что открывается |
|---|---|
| `/` | прототип |
| `/lifecycle` | модель жизненного цикла камеры |
| `/healthz` | проверка работоспособности (`ok`, проверяет и базу) |
| `/api/state` | общее состояние демо (используется страницей) |

## Способ 1. Dokploy, сервис Compose (рекомендуется — приложение и база одним сервисом)

1. **Projects → Create Project** → **Create Service → Compose**.
   Name: `Реестр камер — демо`, App Name: `camera-registry-demo`.
2. **Provider**: GitHub, репозиторий `JaydanMoir/camera_registry`, ветка `main`, Compose Path: `docker-compose.yml`.
3. **Environment**: `POSTGRES_PASSWORD=<придумайте надёжный пароль>`.
4. **Deploy**.
5. **Domains → Add Domain**: Service Name `app`, **Container Port 3000**, HTTPS — Let's Encrypt.
6. По желанию: Autodeploy; Basic Auth, если демо нужно закрыть от посторонних.

Данные базы хранятся в томе `pgdata` и переживают перезапуски и передеплой.

## Способ 2. Dokploy: отдельная база и приложение

1. **Create Service → Database → PostgreSQL** (например, `camera-registry-db`). После создания скопируйте **Internal Connection URL**.
2. **Create Service → Application**: GitHub `JaydanMoir/camera_registry`, ветка `main`, Build Type `Dockerfile`.
3. **Environment**: `DATABASE_URL=<Internal Connection URL>`.
4. **Deploy**, затем **Domains**: Container Port **3000**, HTTPS.

## Способ 3. Любой сервер с Docker (без Dokploy)

Из архива `camera_registry-source.zip`:

```bash
POSTGRES_PASSWORD='надёжный-пароль' docker compose up -d --build
```

Чтобы открыть без прокси, в `docker-compose.yml` раскомментируйте `ports: ["8080:3000"]` → `http://адрес-сервера:8080`.

Или из готового образа приложения (`camera-registry-demo-amd64.tar.gz`) и любой PostgreSQL 13+:

```bash
docker load -i camera-registry-demo-amd64.tar.gz
docker run -d --name camera-registry --restart unless-stopped -p 8080:3000 -e DATABASE_URL='postgres://user:pass@host:5432/db' camera-registry-demo:amd64
```

Таблица создаётся сама при первом запуске.

## Что учесть

- Это демо: логика процесса выполняется на странице, сервер хранит общее состояние с контролем версий. В целевой системе логика и права — на сервере (ТЗ).
- Любой, у кого есть адрес, может менять демо-данные. Для показа вне команды включите Basic Auth.
- Подложку карты и адреса браузер зрителя берёт напрямую у `map.yanao.ru`; если ЕКС недоступна — встроенная копия.
- Проверено: `docker compose up` → приложение и база healthy; две вкладки видят изменения друг друга; одновременные изменения не затирают друг друга; данные сохраняются после перезапуска.

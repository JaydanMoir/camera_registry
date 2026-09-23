# Деплой в Dokploy

Прототип — одна статическая страница, сервер и база данных не нужны. Контейнер: nginx, порт 80.

| Путь | Что открывается |
|---|---|
| `/` | прототип (`prototype/index.html`) |
| `/lifecycle` | модель жизненного цикла камеры (`docs/lifecycle.html`) |
| `/healthz` | проверка работоспособности, отвечает `ok` |

## Шаги в Dokploy

1. **Projects → Create Project**, например «Единый реестр камер».
2. В проекте **Create Service → Application**.
3. Вкладка **General → Provider**: GitHub (или Git по URL `https://github.com/JaydanMoir/camera_registry.git`), ветка `main`.
4. **Build Type**: `Dockerfile`, путь — `Dockerfile` (в корне репозитория).
5. **Deploy**. Сборка занимает меньше минуты.
6. Вкладка **Domains → Add Domain**: домен (или сгенерированный Dokploy), **Container Port `80`**, HTTPS — Let's Encrypt.
7. По желанию: **Autodeploy** — пересборка при каждом пуше в `main`.
8. Если демо нужно закрыть от посторонних — включите Basic Auth для приложения в настройках безопасности Dokploy.

## Что учесть

- Данные демо хранятся только в браузере каждого зрителя (localStorage); на сервере ничего не сохраняется.
- Подложка карты и адреса запрашиваются браузером зрителя напрямую у `map.yanao.ru`. Если сервис ЕКС ему недоступен, прототип сам переключается на встроенную копию.
- Проверить образ локально: `docker build -t camera-registry . && docker run --rm -p 8080:80 camera-registry` → http://localhost:8080
- Образ проверен: ~85 МБ, страница отдаётся сжатой (5,5 → 3,7 МБ), `/healthz` → `ok`, healthcheck контейнера — healthy.

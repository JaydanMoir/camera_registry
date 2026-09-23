# Развёртывание демо-прототипа «Единый реестр камер»

Прототип — одна статическая страница: сервер приложений и база данных не нужны. Контейнер — nginx, порт **80**.

| Путь | Что открывается |
|---|---|
| `/` | прототип |
| `/lifecycle` | модель жизненного цикла камеры |
| `/healthz` | проверка работоспособности, ответ `ok` |

Образ проверен: собирается по `Dockerfile`, размер ~85 МБ, страница отдаётся сжатой (5,5 → 3,7 МБ), healthcheck — healthy.

## Способ 1. Dokploy из GitHub (рекомендуется)

1. **Projects → Create Project**, например «Единый реестр камер».
2. **Create Service → Application**.
3. **Provider**: GitHub (или Git по адресу `https://github.com/JaydanMoir/camera_registry.git`), ветка `main`.
4. **Build Type**: `Dockerfile`, путь `Dockerfile`.
5. **Deploy**.
6. **Domains → Add Domain**: домен, **Container Port 80**, HTTPS — Let's Encrypt.
7. По желанию: **Autodeploy** (обновление при каждом пуше в `main`) и Basic Auth, если демо нужно закрыть паролем.

## Способ 2. Dokploy без GitHub — архив с исходниками

Файл `camera_registry-source.zip` содержит всё для сборки (`Dockerfile`, `deploy/nginx.conf`, `docker-compose.yml`, страницы).

- В Dokploy: **Application → Provider: Drop** (загрузка архива) → выбрать zip → Build Type `Dockerfile` → Deploy → домен на порт 80.
- Или **Create Service → Compose**, загрузить содержимое архива и указать `docker-compose.yml`; домен — на сервис `camera-registry`, порт 80.

## Способ 3. Готовый образ, без сборки

Файлы `camera-registry-image-amd64.tar.gz` (обычный сервер, x86-64) и `camera-registry-image-arm64.tar.gz` (ARM).

```bash
docker load -i camera-registry-image-amd64.tar.gz
docker run -d --name camera-registry --restart unless-stopped -p 8080:80 camera-registry:amd64
```

Открыть `http://адрес-сервера:8080`. В Dokploy такой образ можно использовать через **Provider: Docker**, если загрузить его в реестр образов (Docker Hub, GHCR или свой).

## Что учесть

- Данные демо хранятся только в браузере каждого зрителя (localStorage). На сервере ничего не сохраняется, резервные копии не нужны.
- Подложку карты и адреса браузер зрителя запрашивает напрямую у `map.yanao.ru`. Если ЕКС зрителю недоступна, прототип сам переключается на встроенную копию.
- Обновление: новая версия `prototype/index.html` → пуш в `main` (способ 1) или новый архив/образ (способы 2–3).
- Проверка локально: `docker build -t camera-registry . && docker run --rm -p 8080:80 camera-registry` → http://localhost:8080

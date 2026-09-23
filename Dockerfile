# Демо-прототип «Единый реестр камер» — статическая страница, отдаётся nginx.
FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY prototype/index.html /usr/share/nginx/html/index.html
COPY docs/ /usr/share/nginx/html/docs/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1

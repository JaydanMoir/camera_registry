# Демо «Единый реестр камер»: Node.js отдаёт страницу прототипа и хранит общие данные в PostgreSQL.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/ ./server/
COPY prototype/index.html ./public/index.html
COPY docs/ ./public/docs/

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/server.js"]

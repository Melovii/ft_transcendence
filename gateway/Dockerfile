# Gateway: builds the React SPA, then serves it from nginx behind TLS.
# Build context is the repository root; see .dockerignore for what is excluded.

FROM node:22-alpine AS spa

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY gateway/nginx.conf /etc/nginx/nginx.conf
COPY --from=spa /app/dist /usr/share/nginx/html

EXPOSE 443
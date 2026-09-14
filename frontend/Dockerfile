# Frontend: static build served by Caddy, which also proxies /api to the backend.
# Build context is the repository root: the frontend imports the backend's
# route and metadata types, so both packages' dependencies are needed to build.
FROM node:26-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci
COPY backend/tsconfig.json backend/
COPY backend/src backend/src
COPY frontend frontend
RUN cd frontend && npm run build

FROM caddy:2-alpine
COPY frontend/Caddyfile.prod /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv

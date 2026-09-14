# Backend: TypeScript compiled once, run with production dependencies only.
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Album storage; mount a volume here (see compose.prod.yml).
VOLUME /app/albums
EXPOSE 3001
CMD ["node", "dist/index.js"]

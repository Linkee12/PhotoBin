FROM node:alpine as build

# Build backend, required for typescript types
COPY ./backend/package*.json /app/backend/
WORKDIR /app/backend
RUN npm install 
COPY ./backend/. /app/backend/
RUN npm run build

# Build frontend
COPY ./frontend/package*.json /app/frontend/
WORKDIR /app/frontend
RUN npm install 
COPY ./frontend/. /app/frontend/
RUN npm run build

FROM nginx:alpine
COPY ./frontend/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html


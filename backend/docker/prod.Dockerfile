FROM node:latest

COPY ./package*.json /app/
WORKDIR /app
RUN npm ci

COPY . /app/
WORKDIR /app
RUN npm run build

CMD ["npm", "start"]
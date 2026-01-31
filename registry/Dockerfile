FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p /data

EXPOSE 3000
ENV NODE_ENV=production
ENV DB_PATH=/data/registry.db

CMD ["npm", "start"]

FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/server.js"]

FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --workspace backend --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app ./
COPY backend ./backend

WORKDIR /app/backend

EXPOSE 3001

CMD ["node", "src/server.js"]

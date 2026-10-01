FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./tsconfig.base.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY shared shared
COPY server server
RUN npm run build -w shared && npm run build -w server

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "--import", "tsx", "server/src/index.ts"]
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js engine.js ./
COPY public ./public
ENV NODE_ENV=production
# Cloud Run は PORT 環境変数(通常 8080)を渡してきます。server.js がそれを読みます。
CMD ["node", "server.js"]

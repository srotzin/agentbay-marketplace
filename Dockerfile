FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN node src/seed-expanded.js
EXPOSE 3000
CMD ["node", "src/server.js"]

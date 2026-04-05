FROM node:22-slim

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Create data directory and seed
RUN mkdir -p data && node src/seed-expanded.js

EXPOSE 3000
CMD ["node", "src/server.js"]

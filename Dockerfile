FROM node:22-slim

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Create data directory
RUN mkdir -p data

# Seed on startup instead of build (avoids module init issues)
# The start script will seed if db doesn't exist

EXPOSE 3000
CMD ["node", "start.js"]

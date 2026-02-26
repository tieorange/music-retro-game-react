# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
# We need devDependencies for now because types might be needed at runtime if some TS execution is involved, 
# but usually dist/ is pure JS. However, keeping it simple for now.
RUN npm install --production

# Copy built assets
COPY --from=builder /app/dist ./dist

# The app might need some assets or other files from src if they are not just TS
# But based on the build, dist should be enough.

EXPOSE 3000
CMD ["npm", "run", "start:api"]

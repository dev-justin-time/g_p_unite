FROM node:20-alpine

# Install Chromium for headless browser
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CDP_PORT=9222

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY src/ ./src/

EXPOSE 3000 9222

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/status || exit 1

CMD ["node", "src/index.js"]
# Gunakan base image Node.js yang ringan
FROM node:20-slim

# Set environment default agar puppeteer tahu lokasi Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Install dependencies Chrome dan fonts untuk render halaman
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxkbcommon0 \
    libxshmfence1 \
    libgbm1 \
    libnss3 \
    libxss1 \
    libgtk-3-0 \
    libdrm2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Tambahkan repo Google Chrome dan install
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Buat folder kerja
WORKDIR /app

# Copy dependency list dan install (lebih efisien untuk cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copy semua file project
COPY . .

# Railway otomatis set PORT, jadi pastikan pakai ini
EXPOSE 3000
ENV PORT=3000
ENV HEADLESS=true
ENV NAVIGATE_TIMEOUT_MS=60000
ENV WAIT_TOKEN_MS=120000

# Jalankan server
CMD ["node", "index.js"]
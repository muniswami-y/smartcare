# Stage 1: Build the static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifests and package manifests
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install --workspace=frontend

# Copy frontend source
COPY frontend/ ./frontend/

# Build production bundle
RUN npm run build --workspace=frontend

# Stage 2: Serve via Nginx unprivileged
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Custom nginx config for SPA routing and security headers
RUN echo 'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  add_header X-Frame-Options "DENY" always;' \
  '  add_header X-Content-Type-Options "nosniff" always;' \
  '  add_header Referrer-Policy "strict-origin-when-cross-origin" always;' \
  '  add_header Content-Security-Policy "default-src '\''self'\''; connect-src '\''self'\'' https:; img-src '\''self'\'' data: https: blob:; style-src '\''self'\'' '\''unsafe-inline'\'' https://fonts.googleapis.com; font-src '\''self'\'' https://fonts.gstatic.com; script-src '\''self'\'' '\''unsafe-inline'\'';" always;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '  location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg)$ {' \
  '    expires 6M;' \
  '    access_log off;' \
  '    add_header Cache-Control "public, max-age=15552000, immutable";' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

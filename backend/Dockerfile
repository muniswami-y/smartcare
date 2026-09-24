FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package.json ./
COPY database/package.json ./database/
COPY backend/package.json ./backend/

# Install dependencies
RUN npm install --workspace=database --workspace=backend

# Copy sources
COPY database ./database
COPY backend ./backend

# Build database package and Prisma client
RUN npm run build --workspace=database
RUN cd database && npx prisma generate

# Build backend
RUN npm run build --workspace=backend
RUN npm run generate:openapi --workspace=backend

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create unprivileged application user
RUN addgroup -S caresmart && adduser -S caresmart -G caresmart

# Copy built artifacts and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/database ./database
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/src/openapi/openapi.json ./backend/dist/openapi/openapi.json
COPY --from=builder /app/node_modules ./node_modules

# Ensure upload directory exists and is owned by non-root user
RUN mkdir -p /app/uploads && chown -R caresmart:caresmart /app

USER caresmart

EXPOSE 4000

CMD ["node", "backend/dist/server.js"]

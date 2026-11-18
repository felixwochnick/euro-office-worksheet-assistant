# Build context is the repository root (npm workspaces: the server uses packages/shared and, for QR codes,
# vendor/qrcode-generator):
#   docker build -f apps/server/Dockerfile .
# or simply `docker compose up` inside apps/server/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
# Only the server's workspace (and the shared package it links to) – not the desktop app or the website.
RUN npm ci --no-audit --no-fund --workspace @worksheet-assistant/server
COPY packages/shared ./packages/shared
COPY vendor/qrcode-generator ./vendor/qrcode-generator
COPY apps/server ./apps/server
RUN npm run build --workspace @worksheet-assistant/server \
  && npm prune --omit=dev --no-audit --no-fund --workspace @worksheet-assistant/server \
  && mkdir -p apps/server/node_modules

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/vendor/qrcode-generator ./vendor/qrcode-generator
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
# packages npm could not hoist to the root (version conflicts) – usually empty
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/build/src ./apps/server/build/src
# Sign-ins, OAuth clients and grants (AUTH_MODE=nextcloud) – mount a volume here.
RUN mkdir -p /data && chown node:node /data
ENV DATA_DIR=/data
VOLUME ["/data"]
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8787}/healthz" >/dev/null || exit 1
CMD ["node", "apps/server/build/src/server.js"]

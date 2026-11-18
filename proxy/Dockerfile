# Build context is the repository root (the proxy uses ../shared/*.js and, for QR codes, ../vendor/qrcode-generator):
#   docker build -f proxy/Dockerfile .
# or simply `docker compose up` inside proxy/.
FROM node:22-alpine AS build
WORKDIR /app
COPY proxy/package.json proxy/package-lock.json ./proxy/
RUN cd proxy && npm ci --no-audit --no-fund
COPY shared ./shared
COPY vendor/qrcode-generator ./vendor/qrcode-generator
COPY proxy ./proxy
RUN cd proxy && npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/shared ./shared
COPY --from=build /app/vendor/qrcode-generator ./vendor/qrcode-generator
COPY --from=build /app/proxy/package.json ./proxy/package.json
COPY --from=build /app/proxy/node_modules ./proxy/node_modules
COPY --from=build /app/proxy/build/src ./proxy/build/src
# Sign-ins, OAuth clients and grants (AUTH_MODE=nextcloud) – mount a volume here.
RUN mkdir -p /data && chown node:node /data
ENV DATA_DIR=/data
VOLUME ["/data"]
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8787}/healthz" >/dev/null || exit 1
CMD ["node", "proxy/build/src/server.js"]

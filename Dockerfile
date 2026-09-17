# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# development: used only by docker-compose.dev.yml. Source code is bind-
# mounted over this at runtime, so this stage just needs node_modules
# (including dev dependencies, for ts-node/nest watch mode) in the image.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS development
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && npm ci \
  && apk del .build-deps
COPY . .
CMD ["npm", "run", "start:dev"]

# ---------------------------------------------------------------------------
# builder: compiles TypeScript to dist/. Not shipped itself - only its
# output is copied into the production stage below.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && npm ci \
  && apk del .build-deps
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# production: minimal runtime image. No dev dependencies, no source
# TypeScript, no build tooling - just the compiled app and its production
# node_modules.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache dumb-init curl \
  && addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
# bcrypt ships prebuilt binaries for glibc, not musl (Alpine); a build
# toolchain is needed so npm falls back to compiling it from source. The
# toolchain itself is removed again in the same layer so it never ships.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && npm ci --omit=dev \
  && apk del .build-deps \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /app/storage/files /app/storage/reports \
  && chown -R app:app /app

USER app
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -f http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]

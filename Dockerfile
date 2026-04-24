# syntax=docker/dockerfile:1.7

# ───────────────────────────────────────────────────────────────────────────────
# Stage 1 – base: shared Node.js 24 Alpine image with common env vars
# ───────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS base

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=6580

# ───────────────────────────────────────────────────────────────────────────────
# Stage 2 – build-deps: install ALL deps (including devDependencies) for CSS build
# ───────────────────────────────────────────────────────────────────────────────
FROM base AS build-deps

ENV NODE_ENV=development

RUN apk add --no-cache --virtual .build-deps \
    g++ \
    make \
    python3

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# ───────────────────────────────────────────────────────────────────────────────
# Stage 3 – build: compile Tailwind CSS
# ───────────────────────────────────────────────────────────────────────────────
FROM build-deps AS build

COPY tailwind.config.js postcss.config.js ./
COPY bin ./bin
COPY public ./public
COPY src ./src

RUN npm run build:css

# ───────────────────────────────────────────────────────────────────────────────
# Stage 4 – prod-deps: production node_modules only (+ native rebuild)
# ───────────────────────────────────────────────────────────────────────────────
FROM base AS prod-deps

RUN apk add --no-cache --virtual .build-deps \
    g++ \
    make \
    python3

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3

RUN apk del .build-deps

# ───────────────────────────────────────────────────────────────────────────────
# Stage 5 – runtime: minimal final image
# ───────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

ARG BUILD_DATE
ARG VERSION=dev
ARG VCS_REF

LABEL org.opencontainers.image.title="antigravity-claude-proxy" \
      org.opencontainers.image.description="Anthropic-compatible proxy for Antigravity Cloud Code – with MODEL_ALIASES support" \
      org.opencontainers.image.url="https://github.com/gsmlg-ci/antigravity-claude-proxy" \
      org.opencontainers.image.source="https://github.com/gsmlg-ci/antigravity-claude-proxy" \
      org.opencontainers.image.documentation="https://github.com/gsmlg-ci/antigravity-claude-proxy#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=6580

# tini – proper PID-1 init for graceful shutdown
RUN apk add --no-cache tini && \
    mkdir -p /home/node/.antigravity-claude-proxy && \
    chown -R node:node /app /home/node

# Copy artefacts from previous stages
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY package.json package-lock.json ./
COPY bin ./bin
COPY src ./src

# Make CLI executable and create convenience symlinks
RUN chmod +x /app/bin/cli.js && \
    ln -sf /app/bin/cli.js /usr/local/bin/antigravity-claude-proxy && \
    ln -sf /app/bin/cli.js /usr/local/bin/acc

# Persistent data volume (accounts, tokens, local DB)
VOLUME ["/home/node/.antigravity-claude-proxy"]

# Run as unprivileged user
USER node

EXPOSE 6580

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:6580/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]

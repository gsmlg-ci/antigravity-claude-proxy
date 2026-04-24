# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./

RUN NODE_OPTIONS="--dns-result-order=ipv4first" npm ci --ignore-scripts && \
    npm rebuild better-sqlite3

FROM deps AS build

COPY . .

RUN npm run build:css

FROM deps AS prod-deps

RUN npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine AS runtime

ARG BUILD_DATE
ARG VERSION=dev
ARG VCS_REF

LABEL org.opencontainers.image.title="antigravity-claude-proxy" \
      org.opencontainers.image.description="Dockerized Anthropic-compatible proxy for Antigravity Cloud Code" \
      org.opencontainers.image.url="https://github.com/gsmlg-ci/antigravity-claude-proxy" \
      org.opencontainers.image.source="https://github.com/gsmlg-ci/antigravity-claude-proxy" \
      org.opencontainers.image.documentation="https://github.com/gsmlg-ci/antigravity-claude-proxy#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    HOME=/home/node

WORKDIR /app

RUN apk add --no-cache tini && \
    mkdir -p /home/node/.config/antigravity-proxy /home/node/.antigravity-claude-proxy && \
    chown -R node:node /app /home/node

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node bin ./bin
COPY --chown=node:node src ./src
COPY --chown=node:node LICENSE ./LICENSE

RUN chmod +x /app/bin/cli.js && \
    ln -sf /app/bin/cli.js /usr/local/bin/antigravity-claude-proxy && \
    ln -sf /app/bin/cli.js /usr/local/bin/acc

VOLUME ["/home/node/.config/antigravity-proxy", "/home/node/.antigravity-claude-proxy"]

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]


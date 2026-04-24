# antigravity-claude-proxy (Docker + Model Aliases)

[![Build & Push](https://github.com/gsmlg-ci/antigravity-claude-proxy/actions/workflows/build.yml/badge.svg)](https://github.com/gsmlg-ci/antigravity-claude-proxy/actions/workflows/build.yml)

A **production-ready, Dockerized** fork of [badrisnarayanan/antigravity-claude-proxy](https://github.com/badrisnarayanan/antigravity-claude-proxy) that adds **custom model alias support** via the `MODEL_ALIASES` environment variable.

> **Upstream project**: All core proxy logic (Anthropic ↔ Antigravity translation, multi-account load balancing, WebUI, etc.) comes from the upstream repo. This repo adds Dockerfile, CI/CD, and the model-aliases feature.

---

## Quick Start

```bash
docker run -d \
  --name antigravity-claude-proxy \
  -p 6580:6580 \
  -e MODEL_ALIASES='{"haiku":"claude-sonnet-4-6-thinking","fast":"gemini-3-flash[1m]"}' \
  -v antigravity-proxy-data:/home/node/.antigravity-claude-proxy \
  ghcr.io/gsmlg-ci/antigravity-claude-proxy:latest
```

Then point Claude Code at the proxy:

```bash
export ANTHROPIC_BASE_URL="http://localhost:6580"
export ANTHROPIC_AUTH_TOKEN="test"
claude
```

---

## Table of Contents

- [Features](#features)
- [Model Aliases](#model-aliases)
  - [Configuration](#configuration)
  - [How It Works](#how-it-works)
  - [Examples](#examples)
- [Docker](#docker)
  - [Run from GHCR](#run-from-ghcr)
  - [Docker Compose](#docker-compose)
  - [Build Locally](#build-locally)
  - [Health Check](#health-check)
  - [CLI Inside Container](#cli-inside-container)
- [CI/CD](#cicd)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)

---

## Features

Everything from the upstream project, plus:

| Feature | Description |
|---------|-------------|
| **`MODEL_ALIASES`** | Map short/custom names to real model IDs via a single env var |
| **Multi-arch Docker** | `linux/amd64` + `linux/arm64` images on GHCR |
| **Node.js 24** | Built on `node:24-alpine` |
| **Non-root container** | Runs as `node` user with `tini` as PID-1 |
| **GitHub Actions CI** | Auto-builds on push to `main` and on tags/releases |
| **Healthcheck** | Built-in Docker `HEALTHCHECK` hitting `/health` |

---

## Model Aliases

### Configuration

Set the `MODEL_ALIASES` environment variable to a **JSON object** mapping alias names to real model IDs:

```bash
MODEL_ALIASES='{"gemini-pro":"gemini-3.1-pro-high[1m]","haiku":"claude-sonnet-4-6-thinking","my-opus":"claude-opus-4-6-thinking","fast":"gemini-3-flash[1m]"}'
```

See [`model-aliases.json.example`](./model-aliases.json.example) for a full example.

### How It Works

```
Client sends:  { "model": "haiku", ... }
                        │
                        ▼
             ┌──────────────────────┐
             │  Model Alias         │
             │  Middleware           │
             │  "haiku" → "claude-  │
             │  sonnet-4-6-thinking"│
             └──────────┬───────────┘
                        │
                        ▼
              Request forwarded with
              real model ID to upstream
```

1. **All `/v1/*` endpoints** — The middleware intercepts every request with a `model` field in the JSON body and resolves aliases before the request reaches route handlers.

2. **`GET /v1/models`** — Alias models are appended to the models list with `owned_by: "alias"` and an `alias_target` field showing the real model ID.

3. **Existing features preserved** — `ANTHROPIC_DEFAULT_*_MODEL`, config-based `modelMapping`, role mapping, fallback, and all other features work unchanged.

### Examples

#### Claude Code with aliases

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "test",
    "ANTHROPIC_BASE_URL": "http://localhost:6580",
    "ANTHROPIC_MODEL": "my-opus",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "my-opus",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "haiku",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "fast"
  }
}
```

#### API request

```bash
curl -X POST http://localhost:6580/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "haiku",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1024
  }'
# → model is resolved to "claude-sonnet-4-6-thinking" before forwarding
```

#### List models (includes aliases)

```bash
curl http://localhost:6580/v1/models | jq '.data[] | select(.owned_by == "alias")'
```

---

## Docker

### Run from GHCR

```bash
docker run -d \
  --name antigravity-claude-proxy \
  -p 6580:6580 \
  -e NODE_ENV=production \
  -e MODEL_ALIASES='{"haiku":"claude-sonnet-4-6-thinking","fast":"gemini-3-flash[1m]"}' \
  -v antigravity-proxy-data:/home/node/.antigravity-claude-proxy \
  ghcr.io/gsmlg-ci/antigravity-claude-proxy:latest
```

The application listens on `0.0.0.0:6580` and stores runtime data in `/home/node/.antigravity-claude-proxy`.

The image declares this path as a Docker volume, so account state, tokens, and local proxy data survive container replacement when you mount it:

```bash
-v antigravity-proxy-data:/home/node/.antigravity-claude-proxy
```

### Docker Compose

```bash
docker compose up -d
```

See [`docker-compose.yml`](./docker-compose.yml) for the full example including `MODEL_ALIASES`.

### Build Locally

```bash
docker build -t antigravity-claude-proxy:local .

# Run (pass MODEL_ALIASES as needed)
docker run --rm -p 6580:6580 \
  -e MODEL_ALIASES='{"haiku":"claude-sonnet-4-6-thinking"}' \
  -v antigravity-proxy-data:/home/node/.antigravity-claude-proxy \
  antigravity-claude-proxy:local
```

### Health Check

```bash
curl http://localhost:6580/health
```

### CLI Inside Container

```bash
docker exec -it antigravity-claude-proxy acc status
docker exec -it antigravity-claude-proxy antigravity-claude-proxy accounts list
```

---

## CI/CD

The GitHub Actions workflow at [`.github/workflows/build.yml`](./.github/workflows/build.yml):

| Trigger | Tags produced |
|---------|--------------|
| Push to `main` | `latest`, `sha-<commit>` |
| Git tag (`v1.0.0`) | `latest`, `v1.0.0`, `sha-<commit>` |
| GitHub Release | `latest`, release tag, `sha-<commit>` |

Images are pushed to: `ghcr.io/gsmlg-ci/antigravity-claude-proxy`

Multi-platform: `linux/amd64` + `linux/arm64`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `6580` | Server listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `production` | Node environment |
| `MODEL_ALIASES` | _(empty)_ | JSON object mapping alias names → real model IDs |
| `API_KEY` | _(empty)_ | Optional API key for `/v1/*` endpoint auth |
| `WEBUI_PASSWORD` | _(empty)_ | Optional password for WebUI access |
| `DEBUG` | `false` | Enable debug logging |
| `FALLBACK` | `false` | Enable model fallback on quota exhaustion |
| `HTTP_PROXY` | _(empty)_ | Route upstream requests through a proxy |
| `CLAUDE_CONFIG_PATH` | _(empty)_ | Path to `.claude` dir (for systemd/Docker) |

---

## Architecture

```
┌──────────────────┐     ┌──────────────────────────┐     ┌───────────────────────────┐
│  Claude Code     │────▶│  This Proxy (Docker)     │────▶│  Antigravity Cloud Code   │
│  (Anthropic      │     │  ┌────────────────────┐  │     │  (daily-cloudcode-pa.     │
│   API format)    │     │  │ Model Alias Layer  │  │     │   sandbox.googleapis.com) │
│                  │     │  │ "haiku" → "claude-…│  │     │                           │
│                  │     │  └────────────────────┘  │     │                           │
└──────────────────┘     └──────────────────────────┘     └───────────────────────────┘
```

---

## License

MIT — see upstream [LICENSE](https://github.com/badrisnarayanan/antigravity-claude-proxy/blob/main/LICENSE).

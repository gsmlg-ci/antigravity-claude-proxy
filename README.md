# antigravity-claude-proxy

Production-ready Dockerized fork of `badrisnarayanan/antigravity-claude-proxy` with Node.js 24, container publishing to GHCR, full `MODEL_ALIASES` support, and proxy-visible `AI_CREDIT_OVERAGES` status.

## Highlights

- Node.js 24 on `node:24-alpine`
- Multi-stage minimal image with `tini`, non-root runtime, OCI labels, and healthcheck
- Multi-platform GitHub Actions publishing to `ghcr.io/gsmlg-ci/antigravity-claude-proxy`
- Full alias rewriting for incoming `/v1/*` JSON requests with a top-level `model`
- Alias-aware `/v1/models`
- Alias-aware Web UI model selectors
- `/account-limits` exposes `modelAliases` and `aiCreditOverages`
- Dashboard shows the current AI credit overages mode

## Feature: `MODEL_ALIASES`

Set `MODEL_ALIASES` to a JSON object:

```bash
MODEL_ALIASES='{"gemini-3-pro":"gemini-3.1-pro-high[1m]","haiku":"claude-sonnet-4-6-thinking","my-opus":"claude-opus-4-6-thinking","fast":"gemini-3-flash[1m]"}'
```

Behavior:

- Any `/v1/*` JSON request with a top-level `model` field is rewritten before route handling.
- `/v1/models` returns alias entries in addition to upstream models when the alias target exists.
- `/account-limits` includes alias IDs and mirrors quota data from the alias target so the UI stays consistent.
- Alias IDs appear in the Web UI selectors and model configuration screens.

Example:

```bash
curl -X POST http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "haiku",
    "messages": [{"role": "user", "content": "hello"}],
    "max_tokens": 512
  }'
```

That request is forwarded upstream as `claude-sonnet-4-6-thinking`.

## Feature: `AI_CREDIT_OVERAGES`

Supported values:

- `never`
- `always`
- `default`

Example:

```bash
AI_CREDIT_OVERAGES=default
```

Current behavior:

- The proxy reads and validates the setting at startup.
- The current mode is exposed in `/account-limits` as `aiCreditOverages`.
- The dashboard displays the current mode and its forwarding status.
- The setting is currently `visibility-only`.

Limitation:

- Based on the currently observed Antigravity internal APIs used by this proxy (`loadCodeAssist`, `fetchAvailableModels`, `generateContent`, `streamGenerateContent`), there is no documented per-request or session-level parameter for toggling AI credit overages from the proxy side.
- Because of that, this fork does **not** invent an unsupported header or query parameter.
- The authoritative control remains the toggle in Antigravity account settings.
- This env var is therefore a proxy-level convenience for visibility, deployment defaults, and operator awareness rather than a hard enforcement mechanism.

## Docker

### Run from GHCR

```bash
docker run -d \
  --name antigravity-claude-proxy \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e API_KEY=change-me \
  -e GOOGLE_OAUTH_CLIENT_ID=your-client-id \
  -e GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret \
  -e MODEL_ALIASES='{"haiku":"claude-sonnet-4-6-thinking","fast":"gemini-3-flash[1m]"}' \
  -e AI_CREDIT_OVERAGES=default \
  -v antigravity-proxy-config:/home/node/.config/antigravity-proxy \
  -v antigravity-proxy-data:/home/node/.antigravity-claude-proxy \
  ghcr.io/gsmlg-ci/antigravity-claude-proxy:latest
```

The service binds to `0.0.0.0:8080`.

If you want the built-in OAuth account-adding flow, you must provide:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

Persistent data paths:

- `/home/node/.config/antigravity-proxy`
- `/home/node/.antigravity-claude-proxy`

### Health check

```bash
curl http://localhost:8080/health
```

### Compose example

See [`docker-compose.yml`](./docker-compose.yml).

## Local build

```bash
npm install
npm run build:css
npm start
```

## GitHub Actions

`.github/workflows/build.yml`:

- runs on pushes to `main`
- runs on version tags
- runs on published releases
- builds `linux/amd64` and `linux/arm64`
- pushes to `ghcr.io/gsmlg-ci/antigravity-claude-proxy`
- publishes `latest`, tag/version tags, and short SHA tags

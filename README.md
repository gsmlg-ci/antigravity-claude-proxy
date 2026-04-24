# antigravity-claude-proxy

## Docker

### Run from GHCR

```bash
docker run -d \
  --name antigravity-claude-proxy \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e MODEL_ALIASES='{"haiku":"claude-sonnet-4-6-thinking","fast":"gemini-3-flash[1m]"}' \
  -v antigravity-proxy-data:/home/node/.antigravity-claude-proxy \
  ghcr.io/gsmlg-ci/antigravity-claude-proxy:latest
```

The application listens on `0.0.0.0:8080` and stores runtime data in `/home/node/.antigravity-claude-proxy`.

The image declares that path as a Docker volume so accounts, tokens, and local proxy data survive container replacement.

### Health check

```bash
curl http://localhost:8080/health
```

### Run the bundled CLI

```bash
docker exec -it antigravity-claude-proxy acc status
docker exec -it antigravity-claude-proxy antigravity-claude-proxy accounts list
```

### Model aliases

`MODEL_ALIASES` accepts a JSON object that maps custom names to real upstream model IDs:

```bash
MODEL_ALIASES='{"gemini-3-pro":"gemini-3.1-pro-high[1m]","haiku":"claude-sonnet-4-6-thinking","my-opus":"claude-opus-4-6-thinking","fast":"gemini-3-flash[1m]"}'
```

Behavior:

- Any `/v1/*` JSON request with a `model` field is rewritten before the upstream handler runs.
- Existing config-based `modelMapping` still works and runs after alias resolution.
- `GET /v1/models` includes alias IDs alongside upstream models when the alias target exists.
- If the web UI model selector reads `/v1/models`, aliases appear there automatically.

Example:

```bash
curl -X POST http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "haiku",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 512
  }'
```

That request is forwarded with `model` resolved to `claude-sonnet-4-6-thinking`.

### Compose example

See [`docker-compose.yml`](./docker-compose.yml).

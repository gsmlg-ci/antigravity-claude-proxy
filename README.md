# antigravity-claude-proxy

## Docker

### Run from GHCR

```bash
docker run -d \
  --name antigravity-claude-proxy \
  -p 6580:6580 \
  -e NODE_ENV=production \
  -v antigravity-proxy-data:/home/node/.antigravity-claude-proxy \
  ghcr.io/gsmlg-dev/antigravity-claude-proxy:latest
```

The application listens on `0.0.0.0:6580` and stores runtime data in `/home/node/.antigravity-claude-proxy`.

### Health check

```bash
curl http://localhost:6580/health
```

### Run the bundled CLI

```bash
docker exec -it antigravity-claude-proxy acc status
docker exec -it antigravity-claude-proxy antigravity-claude-proxy accounts list
```

### Build locally

```bash
docker build -t antigravity-claude-proxy:local .
docker run --rm -p 6580:6580 antigravity-claude-proxy:local
```

### Compose example

See [`docker-compose.yml`](./docker-compose.yml).

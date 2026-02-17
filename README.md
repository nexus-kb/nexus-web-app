# Nexus Web App

Three-column frontend aligned with the redesign docs:

- Collapsible left rail
- Thread list + long-thread conversation pane
- Series timeline/detail/version/compare workspace
- Diff file-tree + lazy file/full diff workspace
- Search route scaffold

## Runtime Model

The app uses a strict Next.js BFF architecture:

- Browser code calls only same-origin Next.js routes (`/api/*` in this app).
- Next.js server code calls the Rust API using one required env var.
- No client-side direct calls to the Rust API host.

## Required Environment Variables

- Required in server runtime (local dev, container, and deploy):
  - `NEXUS_WEB_API_BASE_URL`
- No `NEXT_PUBLIC_*` environment variables are required by this app.

Common values:

- Host-run web process -> `NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000`
- Compose web container -> `NEXUS_WEB_API_BASE_URL=http://api:3000`

If `NEXUS_WEB_API_BASE_URL` is missing, server data loading fails fast with an explicit error.

## Container-first Dev Workflow

From repo root:

```bash
podman compose -f compose.yml up -d --build web api worker postgres meilisearch
```

or:

```bash
docker compose -f compose.yml up -d --build web api worker postgres meilisearch
```

The web container uses `nexus-web-app/Dockerfile.dev`, mounts source from host, and runs `next dev --turbopack` on `0.0.0.0:3001`.

## Production Docker image

Build production image:

```bash
docker build -t nexus-web-app:prod -f Dockerfile .
```

Run:

```bash
docker run --name nexus-web --rm -p 3001:3001 \
  -e NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000 \
  nexus-web-app:prod
```

Run with explicit user mapping:

```bash
docker run --name nexus-web --rm -p 3001:3001 \
  --user 1000:1000 \
  -e NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000 \
  nexus-web-app:prod
```

For rootless Podman/Quadlet production, prefer `--userns=keep-id` with explicit `--user <host_uid>:<host_gid>` (or equivalent Quadlet settings). This repository does not support `PUID`/`PGID` env-based remapping.

## Run

```bash
NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000 pnpm dev
```

Open <http://localhost:3001>.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

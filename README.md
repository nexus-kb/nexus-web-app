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

## Required Environment

Set this in server runtime (local dev, container, and deploy):

```bash
NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000
```

If this variable is missing, server data loading fails fast with an explicit error.

## Container-first Dev Workflow

From repo root:

```bash
podman compose -f compose.yml up -d --build web api worker postgres meilisearch
```

or:

```bash
docker compose -f compose.yml up -d --build web api worker postgres meilisearch
```

The web container uses `nexus-web-app/Dockerfile.dev`, mounts source from host, and runs `next dev --webpack` on `0.0.0.0:3001`.

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

# Nexus Web App

Three-column frontend aligned with the redesign docs:

- Collapsible left rail
- Thread list + long-thread conversation pane
- Series timeline/detail/version/compare workspace
- Diff file-tree + lazy file/full diff workspace
- Search workspace

## Runtime Model

The app is a static Next.js export served by nginx:

- Next.js builds static assets (`output: export`).
- nginx serves the exported files.
- Browser code calls Rust API directly via same-origin `/api/v1/*`.
- nginx reverse-proxies `/api/v1/*` (and `/admin/v1/*`) to backend.

There is no Next.js server runtime and no `app/api/*` BFF layer.

## Runtime Environment

Web container runtime env:

- `NEXUS_API_UPSTREAM` (optional, default `http://api:3000`)
  - Used by nginx template for API proxy pass.

No `NEXUS_WEB_API_BASE_URL` or `NEXT_PUBLIC_*` env vars are required.

## Container-first Workflow (Production Image in Dev)

From repo root:

```bash
podman compose -f compose.yml up -d --build web api worker postgres meilisearch
```

or:

```bash
docker compose -f compose.yml up -d --build web api worker postgres meilisearch
```

After frontend code changes, rebuild/restart web:

```bash
podman compose -f compose.yml up -d --build web
```

## Production Docker Image

Build:

```bash
docker build -t nexus-web-app:prod -f Dockerfile .
```

Run:

```bash
docker run --name nexus-web --rm -p 3001:3001 \
  -e NEXUS_API_UPSTREAM=http://127.0.0.1:3000 \
  nexus-web-app:prod
```

Open <http://localhost:3001>.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

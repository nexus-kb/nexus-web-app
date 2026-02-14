# Nexus Web App (Live Tickets 1-20)

Three-column, high-density frontend aligned with the redesign docs:

- Collapsible left rail
- Thread list + paginated conversation pane
- Series timeline/detail/version/compare workspace
- Diff file-tree + lazy file/full diff workspace
- Search route remains scaffolded (ticket 21+)

## Container-first dev workflow (recommended)

Use the root `compose.yml` so the web app runs in live HTTP mode with hot reload.

From repo root:

```bash
podman compose -f compose.yml up -d --build web api worker postgres meilisearch
```

or:

```bash
docker compose -f compose.yml up -d --build web api worker postgres meilisearch
```

Notes:

- Web uses `nexus-web-app/Dockerfile.dev`.
- Source is bind-mounted from host (`./nexus-web-app`).
- The container runs `next dev --webpack` on `0.0.0.0:3001`; host is `http://127.0.0.1:3001`.
- Compose hardcodes live mode defaults:
  - `NEXUS_WEB_API_MODE=http`
  - `NEXUS_WEB_API_BASE_URL=http://api:3000`
  - `NEXT_PUBLIC_NEXUS_WEB_API_MODE=http`
  - `NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000`

## Environment

If `NEXUS_WEB_API_BASE_URL` (or `NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL`) is set and
`NEXUS_WEB_API_MODE` is unset, the app resolves to live HTTP mode automatically.
Set mode explicitly when you need fixtures.

```bash
NEXUS_WEB_API_MODE=fixture # optional when you want mocked data
NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000
```

For browser-visible config you can also set:

```bash
NEXT_PUBLIC_NEXUS_WEB_API_MODE=fixture|http
NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000
```

Live mode example:

```bash
NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000 pnpm dev
```

Fixture mode example:

```bash
NEXUS_WEB_API_MODE=fixture pnpm dev
```

## Run

```bash
pnpm dev
```

Open <http://localhost:3001>.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Notes

`openapi.json` is a legacy snapshot and is not the source of truth for this redesign. Use:

- `ai-docs/nexus-kb-api-endpoint-map.md`
- `ai-docs/nexus-kb-redesign-doc.md`

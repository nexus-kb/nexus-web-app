# Nexus Web App (Threads Core Shell)

Three-column, thread-first frontend scaffold aligned with the redesign docs:

- Collapsible left rail
- Thread list center pane
- Conversation detail right pane
- Route scaffolding for `series`, `diff`, and `search`

## Environment

Adapter mode defaults to fixtures.

```bash
NEXUS_WEB_API_MODE=fixture|http
NEXUS_WEB_API_BASE_URL=http://localhost:3000
```

For browser-visible config you can also set:

```bash
NEXT_PUBLIC_NEXUS_WEB_API_MODE=fixture|http
NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL=http://localhost:3000
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

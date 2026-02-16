# Agent Dev Environment Runbook

## Purpose
Use this runbook to start the local Nexus web dev environment in a repeatable way for agent work (including Next.js MCP checks).

## Assumptions
- API access is via SSH to `100.117.55.46`.
- Local API forward is `127.0.0.1:3000`.
- Next.js dev server runs on `3001`.
- `NEXUS_WEB_API_BASE_URL` must point to the forwarded API endpoint.

## Prerequisites
Run from repo root:

```bash
pnpm install
```

Required runtime env var for the web app:

```bash
NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000
```

## Start API Tunnel
In terminal 1, run:

```bash
ssh -N -L 3000:127.0.0.1:3000 100.117.55.46
```

Keep this terminal open while developing.

## Run Web Dev Server
In terminal 2, run:

```bash
NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000 pnpm dev
```

Expected URL:
- `http://localhost:3001`

## Next.js MCP Workflow
After the dev server is running:

1. Initialize Next.js MCP for this project:
   - `mcp__next-devtools__init({"project_path":"/Users/egor/Documents/new-nexus-app/nexus-web-app"})`
2. Discover running server(s):
   - `mcp__next-devtools__nextjs_index({})`
3. Verify runtime state:
   - `mcp__next-devtools__nextjs_call({"port":"3001","toolName":"get_routes"})`
   - `mcp__next-devtools__nextjs_call({"port":"3001","toolName":"get_errors"})`

If auto-discovery fails, run `nextjs_index` with port `3001`.

## Sanity Checks
Verify API is reachable through the tunnel:

```bash
curl -i http://127.0.0.1:3000/api/v1/openapi.json
```

Verify web app:
- Open `http://localhost:3001`
- Confirm these pages load: `/lists/<listKey>/threads`, `/series`, `/search`

## Common Failures And Fixes

### `ECONNREFUSED 127.0.0.1:3000` in Next.js logs
Cause: API tunnel is not active or target is unreachable.

Fix:
1. Ensure SSH tunnel terminal is still running.
2. Re-run:
```bash
ssh -N -L 3000:127.0.0.1:3000 100.117.55.46
```
3. Re-check:
```bash
curl -i http://127.0.0.1:3000/api/v1/openapi.json
```

### Tunnel not running / unsure which process holds port 3000
Check:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

If needed, stop stale process and restart the tunnel.

### MCP cannot find Next.js server
Fix:
1. Confirm dev server is running on `3001`.
2. Confirm project uses Next.js 16+.
3. Re-run MCP discovery and specify port `3001` if needed.
4. Check `get_errors` after opening app pages in browser automation.

### Port conflicts on 3000 or 3001
Check listeners:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Stop conflicting process, then restart tunnel/dev server.

## Shutdown
1. Stop Next.js dev server (`Ctrl+C`) in terminal 2.
2. Stop SSH tunnel (`Ctrl+C`) in terminal 1.
3. Optional verification:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

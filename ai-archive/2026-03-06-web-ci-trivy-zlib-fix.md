# 2026-03-06 - Web CI Trivy zlib Fix

## Scope
Fixed the `nexus-web-app` publish pipeline failure caused by a critical OS vulnerability detected by Trivy in the runtime image built from `Dockerfile`.

## Why
`Publish GHCR image` built `local/nexus-web-app:scan` from `docker.io/library/nginx:1.29-alpine`, which currently resolves to Alpine `3.23.3` and shipped `zlib 1.3.1-r2`. Trivy `0.69.2` flagged `CVE-2026-22184` against that package and failed the publish gate before image push.

## Implemented
1. Updated the runtime stage in `Dockerfile`.
   - Added `RUN apk add --no-cache --upgrade zlib`.
   - Kept the existing base image and runtime contract unchanged.

2. Confirmed the vulnerability source and fix path.
   - Reproduced the image locally from the current `Dockerfile`.
   - Verified the upstream `nginx:1.29-alpine` image contained `zlib 1.3.1-r2`.
   - Verified Alpine `v3.23` now publishes `zlib 1.3.2-r0`.

3. Validated the patched image.
   - Rebuilt the image locally as `local/nexus-web-app:scan-fixed`.
   - Verified the runtime image now installs `zlib 1.3.2-r0`.
   - Exported the image tarball and ran Trivy `0.69.2` against it with the same critical vulnerability gate settings used in CI.

## Validation
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `docker build -t local/nexus-web-app:scan-fixed -f Dockerfile .`
- `docker run --rm --entrypoint sh local/nexus-web-app:scan-fixed -lc "cat /etc/alpine-release && apk info -v zlib && apk policy zlib"`
- `docker run --rm --user 0 -v /home/tansanrao/work/nexus/nexus-web-app:/scan:ro aquasec/trivy:0.69.2 image --input /scan/.tmp/nexus-web-app-scan-fixed.tar --ignore-unfixed --severity CRITICAL --scanners vuln --exit-code 1 --format table`

## Notes
- `pnpm build` attempted to rewrite `tsconfig.json` locally to add `.next/dev/types/**/*.ts`; that change was not part of this fix and was reverted.
- No `ai-docs/` design documents required updates because the change does not alter architecture, API shape, worker behavior, or public contracts.

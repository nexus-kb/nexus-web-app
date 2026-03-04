# 2026-03-04 - CI Workflow Hardening (Web)

## Scope
Refactored `.github/workflows/tests.yml` for `nexus-web-app` to align with strict CI/CD best practices while preserving existing job contracts (`Verify`, `Publish GHCR image`).

## Why
The linked failing run passed `Verify` and failed in publish at Trivy scan. The previous flow pushed the image before scanning, which made security failures occur after artifact publication work had already started.

## Implemented
1. Hardened action references
   - Pinned third-party actions to immutable SHAs.

2. Strengthened verify job
   - Kept Node 22 + pnpm setup.
   - Added explicit cache lock targeting (`cache-dependency-path: pnpm-lock.yaml`).
   - Kept quality/build gates:
     - `pnpm lint`
     - `pnpm typecheck`
     - `pnpm test`
     - `pnpm build`
     - `test -f out/index.html`
   - Added `timeout-minutes`.

3. Refactored publish job to pre-push security gating
   - Build local candidate image (`load: true`, `local/nexus-web-app:scan`).
   - Run strict blocking Trivy gates before push:
     - Gate 1: critical vulnerabilities (`scanners=vuln`, `severity=CRITICAL`, `ignore-unfixed=true`, `vuln-type=os,library`).
     - Gate 2: secrets (`scanners=secret`).
   - Build and push to GHCR only after both gates pass.

4. Added security reporting
   - Added always-on SARIF generation via Trivy.
   - Added SARIF upload via `github/codeql-action/upload-sarif`.
   - Added publish summary with vulnerability gate, secret gate, and push outcome.

## Permissions / Contract Changes
- `publish` job now requires `security-events: write` in addition to `contents: read` and `packages: write`.

## Validation
- Local repo commands passed before workflow finalization:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`

## Notes
- Job names were kept unchanged to avoid branch protection status-check churn.
- Security policy is strict by design: blocking for critical vulnerabilities and secrets.

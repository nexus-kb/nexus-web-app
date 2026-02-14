import "server-only";

const SAFE_PROXY_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "content-disposition",
] as const;

export function parsePositiveIntParam(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parseBooleanParam(raw: string | null): boolean | null {
  if (raw == null || raw === "") {
    return null;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return null;
}

export function buildProxyResponse(upstream: Response): Response {
  const headers = new Headers();
  for (const headerName of SAFE_PROXY_RESPONSE_HEADERS) {
    const headerValue = upstream.headers.get(headerName);
    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

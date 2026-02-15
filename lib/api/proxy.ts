import "server-only";

const SAFE_PROXY_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "content-disposition",
] as const;

const INGRESS_FORWARD_HEADER_NAMES = [
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "true-client-ip",
  "x-forwarded-for",
  "x-real-ip",
  "cf-ray",
  "cf-ipcountry",
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

function firstForwardedForValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const first = value
    .split(",")
    .map((segment) => segment.trim())
    .find((segment) => segment.length > 0);
  return first ?? null;
}

export function buildForwardedIngressHeaders(
  requestHeaders: Headers | HeadersInit | null | undefined,
  extraHeaders?: HeadersInit,
): Headers {
  const source = new Headers(requestHeaders ?? undefined);
  const merged = new Headers(extraHeaders);

  for (const name of INGRESS_FORWARD_HEADER_NAMES) {
    const value = source.get(name);
    if (!value || merged.has(name)) {
      continue;
    }
    merged.set(name, value);
  }

  if (!merged.has("x-forwarded-for")) {
    const cfIp =
      merged.get("cf-connecting-ip") ??
      merged.get("true-client-ip") ??
      merged.get("cf-connecting-ipv6");
    if (cfIp) {
      merged.set("x-forwarded-for", cfIp);
    }
  }

  if (!merged.has("x-real-ip")) {
    const firstForwarded = firstForwardedForValue(merged.get("x-forwarded-for"));
    if (firstForwarded) {
      merged.set("x-real-ip", firstForwarded);
    }
  }

  return merged;
}

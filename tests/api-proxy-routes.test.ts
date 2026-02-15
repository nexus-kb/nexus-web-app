import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getMessageBodyRoute } from "@/app/api/messages/[messageId]/body/route";
import { GET as getPatchItemFileDiffRoute } from "@/app/api/patch-items/[patchItemId]/files/diff/[...path]/route";
import { GET as getSeriesExportMboxRoute } from "@/app/api/series/[seriesId]/versions/[seriesVersionId]/export/mbox/route";

function requestWithNextUrl(url: string, headers?: HeadersInit) {
  return {
    nextUrl: new URL(url),
    headers: new Headers(headers),
  } as unknown as import("next/server").NextRequest;
}

describe("BFF API route handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies message body with safe headers and upstream status", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const upstreamPayload = {
      message_id: 7002,
      subject: "[PATCH] test",
      body_text: "body",
      diff_text: null,
      has_diff: false,
      has_attachments: false,
      attachments: [],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(upstreamPayload), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60",
          etag: "W/\"abc\"",
          "x-internal-secret": "do-not-forward",
        },
      }),
    );

    const response = await getMessageBodyRoute(
      requestWithNextUrl(
        "http://localhost/api/messages/7002/body?include_diff=true&strip_quotes=true",
        {
          "cf-connecting-ip": "203.0.113.45",
        },
      ),
      { params: Promise.resolve({ messageId: "7002" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("etag")).toBe('W/"abc"');
    expect(response.headers.get("x-internal-secret")).toBeNull();
    await expect(response.json()).resolves.toEqual(upstreamPayload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/messages/7002/body?include_diff=true&strip_quotes=true",
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const forwardedHeaders = new Headers(requestInit?.headers);
    expect(forwardedHeaders.get("cf-connecting-ip")).toBe("203.0.113.45");
    expect(forwardedHeaders.get("x-forwarded-for")).toBe("203.0.113.45");
    expect(forwardedHeaders.get("x-real-ip")).toBe("203.0.113.45");
  });

  it("rejects invalid boolean query params before proxying", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await getMessageBodyRoute(
      requestWithNextUrl("http://localhost/api/messages/7002/body?include_diff=bad"),
      { params: Promise.resolve({ messageId: "7002" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid include_diff, expected true or false",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("encodes patch file path and proxies diff endpoint", async () => {
    process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ diff_text: "diff --git ..." }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const response = await getPatchItemFileDiffRoute(new Request("http://localhost"), {
      params: Promise.resolve({
        patchItemId: "77",
        path: ["mm", "vmscan.c"],
      }),
    });

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/patch-items/77/files/mm%2Fvmscan.c/diff",
    );
  });

  it("validates mbox export query booleans", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await getSeriesExportMboxRoute(
      requestWithNextUrl(
        "http://localhost/api/series/12/versions/34/export/mbox?include_cover=maybe",
      ),
      {
        params: Promise.resolve({ seriesId: "12", seriesVersionId: "34" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid include_cover, expected true or false",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

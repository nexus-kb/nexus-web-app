import {
  buildForwardedIngressHeaders,
  buildProxyResponse,
  parsePositiveIntParam,
} from "@/lib/api/proxy";
import { fetchApiResponse } from "@/lib/api/server-client";

interface PatchItemFileDiffRouteContext {
  params: Promise<{ patchItemId: string; path: string[] }>;
}

export async function GET(
  request: Request,
  context: PatchItemFileDiffRouteContext,
): Promise<Response> {
  const { patchItemId, path } = await context.params;
  const parsedPatchItemId = parsePositiveIntParam(patchItemId);
  if (parsedPatchItemId == null) {
    return Response.json({ error: "Invalid patchItemId" }, { status: 400 });
  }

  if (!Array.isArray(path) || path.length === 0) {
    return Response.json({ error: "Invalid diff path" }, { status: 400 });
  }

  const joinedPath = path.join("/");
  const encodedPath = encodeURIComponent(joinedPath);

  const upstream = await fetchApiResponse(
    `/api/v1/patch-items/${parsedPatchItemId}/files/${encodedPath}/diff`,
    {
      cacheProfile: "content",
      init: {
        headers: buildForwardedIngressHeaders(request.headers),
      },
    },
  );

  return buildProxyResponse(upstream);
}

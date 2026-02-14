import { buildProxyResponse, parsePositiveIntParam } from "@/lib/api/proxy";
import { fetchApiResponse } from "@/lib/api/server-client";

interface PatchItemDiffRouteContext {
  params: Promise<{ patchItemId: string }>;
}

export async function GET(_request: Request, context: PatchItemDiffRouteContext): Promise<Response> {
  const { patchItemId } = await context.params;
  const parsedPatchItemId = parsePositiveIntParam(patchItemId);
  if (parsedPatchItemId == null) {
    return Response.json({ error: "Invalid patchItemId" }, { status: 400 });
  }

  const upstream = await fetchApiResponse(`/api/v1/patch-items/${parsedPatchItemId}/diff`, {
    cacheProfile: "content",
  });

  return buildProxyResponse(upstream);
}

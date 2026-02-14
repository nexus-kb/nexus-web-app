import type { NextRequest } from "next/server";

import { buildProxyResponse, parseBooleanParam, parsePositiveIntParam } from "@/lib/api/proxy";
import { fetchApiResponse } from "@/lib/api/server-client";

interface SeriesExportMboxRouteContext {
  params: Promise<{ seriesId: string; seriesVersionId: string }>;
}

export async function GET(
  request: NextRequest,
  context: SeriesExportMboxRouteContext,
): Promise<Response> {
  const { seriesId, seriesVersionId } = await context.params;
  const parsedSeriesId = parsePositiveIntParam(seriesId);
  const parsedSeriesVersionId = parsePositiveIntParam(seriesVersionId);

  if (parsedSeriesId == null) {
    return Response.json({ error: "Invalid seriesId" }, { status: 400 });
  }
  if (parsedSeriesVersionId == null) {
    return Response.json({ error: "Invalid seriesVersionId" }, { status: 400 });
  }

  const assembledRaw = request.nextUrl.searchParams.get("assembled");
  const includeCoverRaw = request.nextUrl.searchParams.get("include_cover");

  const assembled = parseBooleanParam(assembledRaw);
  const includeCover = parseBooleanParam(includeCoverRaw);

  if (assembledRaw != null && assembled == null) {
    return Response.json(
      { error: "Invalid assembled, expected true or false" },
      { status: 400 },
    );
  }

  if (includeCoverRaw != null && includeCover == null) {
    return Response.json(
      { error: "Invalid include_cover, expected true or false" },
      { status: 400 },
    );
  }

  const upstream = await fetchApiResponse(
    `/api/v1/series/${parsedSeriesId}/versions/${parsedSeriesVersionId}/export/mbox`,
    {
      query: {
        assembled,
        include_cover: includeCover,
      },
      cacheProfile: "content",
    },
  );

  return buildProxyResponse(upstream);
}

import type { NextRequest } from "next/server";

import {
  buildForwardedIngressHeaders,
  buildProxyResponse,
  parseBooleanParam,
  parsePositiveIntParam,
} from "@/lib/api/proxy";
import { fetchApiResponse } from "@/lib/api/server-client";

interface MessageBodyRouteContext {
  params: Promise<{ messageId: string }>;
}

export async function GET(
  request: NextRequest,
  context: MessageBodyRouteContext,
): Promise<Response> {
  const { messageId } = await context.params;
  const parsedMessageId = parsePositiveIntParam(messageId);
  if (parsedMessageId == null) {
    return Response.json({ error: "Invalid messageId" }, { status: 400 });
  }

  const includeDiffRaw = request.nextUrl.searchParams.get("include_diff");
  const stripQuotesRaw = request.nextUrl.searchParams.get("strip_quotes");

  const includeDiff = parseBooleanParam(includeDiffRaw);
  const stripQuotes = parseBooleanParam(stripQuotesRaw);

  if (includeDiffRaw != null && includeDiff == null) {
    return Response.json(
      { error: "Invalid include_diff, expected true or false" },
      { status: 400 },
    );
  }

  if (stripQuotesRaw != null && stripQuotes == null) {
    return Response.json(
      { error: "Invalid strip_quotes, expected true or false" },
      { status: 400 },
    );
  }

  const upstream = await fetchApiResponse(`/api/v1/messages/${parsedMessageId}/body`, {
    query: {
      include_diff: includeDiff,
      strip_quotes: stripQuotes,
    },
    cacheProfile: "content",
    init: {
      headers: buildForwardedIngressHeaders(request.headers, {
        Accept: "application/json",
      }),
    },
  });

  return buildProxyResponse(upstream);
}

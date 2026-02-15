import {
  buildForwardedIngressHeaders,
  buildProxyResponse,
  parsePositiveIntParam,
} from "@/lib/api/proxy";
import { fetchApiResponse } from "@/lib/api/server-client";

interface MessageRawRouteContext {
  params: Promise<{ messageId: string }>;
}

export async function GET(request: Request, context: MessageRawRouteContext): Promise<Response> {
  const { messageId } = await context.params;
  const parsedMessageId = parsePositiveIntParam(messageId);
  if (parsedMessageId == null) {
    return Response.json({ error: "Invalid messageId" }, { status: 400 });
  }

  const upstream = await fetchApiResponse(`/api/v1/messages/${parsedMessageId}/raw`, {
    cacheProfile: "content",
    init: {
      headers: buildForwardedIngressHeaders(request.headers),
    },
  });

  return buildProxyResponse(upstream);
}

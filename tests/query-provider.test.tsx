import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQueryClient,
  installAppResumeRefresh,
  isMetadataQueryKey,
  refetchActiveStaleMetadataQueries,
} from "@/components/query-provider";
import { queryKeys } from "@/lib/api/query-keys";

function MetadataProbe({ queryFn }: { queryFn: () => Promise<string> }) {
  useQuery({
    queryKey: queryKeys.lists(),
    queryFn,
    staleTime: 0,
    retry: false,
  });
  return null;
}

function ContentProbe({ queryFn }: { queryFn: () => Promise<string> }) {
  useQuery({
    queryKey: queryKeys.messageBody({ messageId: 77, includeDiff: false }),
    queryFn,
    staleTime: 0,
    retry: false,
  });
  return null;
}

describe("query-provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("identifies metadata query roots", () => {
    expect(isMetadataQueryKey(queryKeys.lists())).toBe(true);
    expect(isMetadataQueryKey(queryKeys.seriesDetail(10))).toBe(true);
    expect(isMetadataQueryKey(queryKeys.messageBody({ messageId: 1, includeDiff: false }))).toBe(
      false,
    );
    expect(isMetadataQueryKey(queryKeys.patchItemDiff(10))).toBe(false);
  });

  it("refetches only active stale metadata queries", async () => {
    const queryClient = createQueryClient();
    const metadataFetch = vi.fn(async () => "metadata");
    const contentFetch = vi.fn(async () => "content");

    render(
      <QueryClientProvider client={queryClient}>
        <MetadataProbe queryFn={metadataFetch} />
        <ContentProbe queryFn={contentFetch} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(metadataFetch).toHaveBeenCalledTimes(1);
      expect(contentFetch).toHaveBeenCalledTimes(1);
    });

    metadataFetch.mockClear();
    contentFetch.mockClear();

    await refetchActiveStaleMetadataQueries(queryClient);

    await waitFor(() => {
      expect(metadataFetch).toHaveBeenCalledTimes(1);
    });
    expect(contentFetch).not.toHaveBeenCalled();
  });

  it("wires app resume events to metadata refetch", async () => {
    const queryClient = createQueryClient();
    const refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);
    const cleanup = installAppResumeRefresh(queryClient);

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(refetchSpy).toHaveBeenCalledTimes(1);
    });

    cleanup();
  });
});

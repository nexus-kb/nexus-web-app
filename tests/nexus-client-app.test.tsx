import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/tests/mocks/navigation";
import { NexusClientApp } from "@/components/nexus-client-app";
import { setNavigationState } from "@/tests/mocks/navigation";

vi.mock("@/components/threads-workspace", () => ({
  ThreadsWorkspace: ({ listKey }: { listKey?: string | null }) => (
    <div>{`threads-workspace:${listKey ?? "none"}`}</div>
  ),
}));

vi.mock("@/components/series-workspace", () => ({
  SeriesWorkspace: ({ selectedListKey }: { selectedListKey?: string | null }) => (
    <div>{`series-workspace:${selectedListKey ?? "none"}`}</div>
  ),
}));

describe("NexusClientApp", () => {
  it("shows a loading screen before hydrating the active workspace", async () => {
    setNavigationState("/threads/lkml");

    render(<NexusClientApp />);

    expect(screen.getByText("Loading workspace")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("threads-workspace:lkml")).toBeInTheDocument();
    });
  });

  it("hands off to the series workspace after hydration", async () => {
    setNavigationState("/series/git");

    render(<NexusClientApp />);

    expect(screen.getByText("Loading workspace")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("series-workspace:git")).toBeInTheDocument();
    });
  });
});

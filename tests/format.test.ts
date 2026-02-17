import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-02-17T12:00:00Z").getTime();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders relative timestamps for recent values", () => {
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(formatRelativeTime("2026-02-17T09:00:00Z")).toMatch(/3\s+hours?\s+ago/i);
    expect(formatRelativeTime("2026-02-11T12:00:00Z")).toMatch(/6\s+days?\s+ago/i);
  });

  it("falls back to absolute date formatting at one week", () => {
    vi.spyOn(Date, "now").mockReturnValue(now);

    const oneWeekAgo = "2026-02-10T12:00:00Z";
    expect(formatRelativeTime(oneWeekAgo)).toBe(formatDateTime(oneWeekAgo));
  });
});

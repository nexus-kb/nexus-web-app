import { describe, expect, it, vi } from "vitest";
import { FixtureNexusApiAdapter } from "@/lib/api/adapters/fixture";
import { HttpNexusApiAdapter } from "@/lib/api/adapters/http";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("API adapters", () => {
  it("fixture adapter returns endpoint-map shaped thread list data", async () => {
    const adapter = new FixtureNexusApiAdapter();

    const threads = await adapter.getThreads({ listKey: "lkml", sort: "activity_desc", limit: 2 });

    expect(Array.isArray(threads.items)).toBe(true);
    expect(threads.items[0]).toMatchObject({
      thread_id: expect.any(Number),
      subject: expect.any(String),
      message_count: expect.any(Number),
    });
    expect(threads.next_cursor).toBeNull();
  });

  it("http adapter normalizes mixed backend payload naming", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/threads/55")) {
        return jsonResponse({
          thread_id: 55,
          list_key: "lkml",
          subject: "Normalized",
          membership_hash: "abc",
          last_activity_at: "2026-02-13T00:00:00Z",
          messages: [
            {
              message_pk: 900,
              parent_message_id: null,
              depth: 0,
              sort_key: "1",
              from_name: "Author",
              from_email: "author@example.com",
              date_utc: "2026-02-13T00:00:00Z",
              subject_raw: "Subject",
              has_diff: true,
              patch_item_id: 77,
            },
          ],
        });
      }

      if (url.includes("/patch-items/77/files")) {
        return jsonResponse([
          {
            new_path: "mm/vmscan.c",
            old_path: "mm/vmscan.c",
            change_type: "M",
            is_binary: false,
            additions: 2,
            deletions: 1,
            hunk_count: 1,
            diff_start: 0,
            diff_end: 10,
          },
        ]);
      }

      if (url.includes("/api/v1/version")) {
        return jsonResponse({
          git_sha: "abc",
          build_time: "2026-02-13T00:00:00Z",
          schema_version: "1",
        });
      }

      return jsonResponse({
        thread_id: 1,
        list_key: "lkml",
        subject: "fallback",
        membership_hash: "h",
        last_activity_at: "2026-02-13T00:00:00Z",
        messages: [],
      });
    });

    const adapter = new HttpNexusApiAdapter("http://localhost:3000");

    const detail = await adapter.getThreadDetail("lkml", 55);
    expect(detail.messages[0]).toMatchObject({
      message_id: 900,
      from: { name: "Author", email: "author@example.com" },
      patch_item_id: 77,
    });

    const files = await adapter.getPatchItemFiles(77);
    expect(files.items[0]).toMatchObject({
      path: "mm/vmscan.c",
      hunks: 1,
      additions: 2,
    });

    const version = await adapter.getVersion();
    expect(version.git_sha).toBe("abc");

    fetchMock.mockRestore();
  });
});

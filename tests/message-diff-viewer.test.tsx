import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { highlightLinesClientMock } = vi.hoisted(() => ({
  highlightLinesClientMock: vi.fn(),
}));

vi.mock("@/lib/highlight/client-shiki", () => ({
  highlightLinesClient: highlightLinesClientMock,
}));

import { MessageDiffViewer } from "@/components/message-diff-viewer";

const SAMPLE_DIFF = `diff --git a/tools/bpf/resolve_btfids/Makefile b/tools/bpf/resolve_btfids/Makefile
index 1111111..2222222 100644
--- a/tools/bpf/resolve_btfids/Makefile
+++ b/tools/bpf/resolve_btfids/Makefile
@@ -1,2 +1,3 @@
 CC := clang
+CFLAGS += -fno-omit-frame-pointer
 all:
diff --git a/kernel/bpf/verifier.c b/kernel/bpf/verifier.c
index aaaaaaa..bbbbbbb 100644
--- a/kernel/bpf/verifier.c
+++ b/kernel/bpf/verifier.c
@@ -10,2 +10,2 @@ static int sample(void)
-return 0;
+return 1;
`;

describe("MessageDiffViewer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    highlightLinesClientMock.mockReset();
  });

  it("defaults to unified mode and switches between unified, split, and raw", async () => {
    const user = userEvent.setup();
    render(<MessageDiffViewer messageId={77} diffText={SAMPLE_DIFF} isDarkTheme={false} />);

    expect(screen.getByRole("button", { name: "Unified" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Split" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raw" })).toBeInTheDocument();

    const fileToggle = screen.getByRole("button", {
      name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
    });
    expect(fileToggle).toHaveAttribute("aria-expanded", "false");

    await user.click(fileToggle);
    expect(fileToggle).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByText(/diff --git a\/tools\/bpf\/resolve_btfids\/Makefile/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Split" }));
    expect(screen.getByText("split")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unified" }));
    expect(screen.getByText("unified")).toBeInTheDocument();
  });

  it("loads per-file highlighting on expand and reuses cache", async () => {
    const user = userEvent.setup();
    highlightLinesClientMock.mockResolvedValue([[{ content: "return 0;", color: "#fff" }]]);

    render(<MessageDiffViewer messageId={88} diffText={SAMPLE_DIFF} isDarkTheme={false} />);

    const fileToggle = screen.getByRole("button", {
      name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
    });

    await user.click(fileToggle);
    await waitFor(() => {
      expect(highlightLinesClientMock).toHaveBeenCalledTimes(1);
    });

    await user.click(fileToggle);
    await user.click(fileToggle);
    expect(highlightLinesClientMock).toHaveBeenCalledTimes(1);
  });

  it("renders a single unified line-number gutter", async () => {
    const user = userEvent.setup();
    highlightLinesClientMock.mockResolvedValue([[{ content: "line", color: "#fff" }]]);

    const { container } = render(
      <MessageDiffViewer messageId={92} diffText={SAMPLE_DIFF} isDarkTheme={false} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
      }),
    );

    await waitFor(() => {
      expect(highlightLinesClientMock).toHaveBeenCalledTimes(1);
    });

    const firstUnifiedRow = container.querySelector(".message-diff-unified-row");
    expect(firstUnifiedRow).not.toBeNull();
    expect(firstUnifiedRow?.querySelectorAll(".message-diff-line-number")).toHaveLength(1);
  });

  it("supports expand-all and collapse-all controls", async () => {
    const user = userEvent.setup();
    highlightLinesClientMock.mockResolvedValue([[{ content: "line", color: "#fff" }]]);

    render(<MessageDiffViewer messageId={89} diffText={SAMPLE_DIFF} isDarkTheme={false} />);

    await user.click(screen.getByRole("button", { name: "Expand all files in diff" }));

    expect(
      screen.getByRole("button", {
        name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Toggle file diff card: kernel/bpf/verifier.c" }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Collapse all files in diff" }));
    expect(
      screen.getByRole("button", {
        name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps only neutral diff presentation controls", async () => {
    const user = userEvent.setup();
    highlightLinesClientMock.mockResolvedValue([[{ content: "line", color: "#fff" }]]);

    render(<MessageDiffViewer messageId={91} diffText={SAMPLE_DIFF} isDarkTheme={false} />);

    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Whitespace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reviewed" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
      }),
    );

    await waitFor(() => {
      expect(highlightLinesClientMock).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back to raw section rendering when highlighting fails", async () => {
    const user = userEvent.setup();
    highlightLinesClientMock.mockRejectedValueOnce(new Error("boom"));

    render(<MessageDiffViewer messageId={90} diffText={SAMPLE_DIFF} isDarkTheme={false} />);

    await user.click(
      screen.getByRole("button", {
        name: "Toggle file diff card: tools/bpf/resolve_btfids/Makefile",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Highlight unavailable, showing raw file diff/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/diff --git a\/tools\/bpf\/resolve_btfids\/Makefile/i)).toBeInTheDocument();
  });
});

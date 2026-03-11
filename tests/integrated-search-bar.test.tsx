import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { IntegratedSearchBar } from "@/components/integrated-search-bar";
import type { IntegratedSearchQuery } from "@/lib/ui/search-query";

const defaults = { list_key: "lkml" };

function makeQuery(overrides?: Partial<IntegratedSearchQuery>): IntegratedSearchQuery {
  return {
    q: "",
    list_key: "lkml",
    author: "",
    from: "",
    to: "",
    has_diff: "",
    merged: "",
    sort: "relevance",
    hybrid: false,
    semantic_ratio: 0.35,
    cursor: "",
    ...overrides,
  };
}

describe("IntegratedSearchBar", () => {
  it("starts with filters collapsed even when sort is active", () => {
    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ sort: "date_desc" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("textbox", { name: "Search query" })).toHaveAttribute(
      "placeholder",
      "Search threads",
    );
  });

  it("keeps filters open across query prop updates", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    const { rerender } = render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery()}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    const authorInput = screen.getByRole("textbox", { name: "Author" });
    await user.type(authorInput, "dev@example.com");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.blur(authorInput);
    expect(onApply).toHaveBeenCalledTimes(1);

    rerender(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ author: "dev@example.com", sort: "date_desc" })}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("textbox", { name: "Author" })).toHaveValue("dev@example.com");
    expect(screen.queryByRole("combobox", { name: "Sort type" })).not.toBeInTheDocument();
  });

  it("renders badges from applied query state instead of unsaved draft edits", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery()}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const authorInput = screen.getByRole("textbox", { name: "Author" });
    await user.type(authorInput, "dev@example.com");

    expect(screen.queryByText("By dev@example.com")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("removes badges by applying updates immediately", () => {
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ author: "dev@example.com" })}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    const removeButton = screen.getByRole("button", { name: "Remove filter By dev@example.com" });
    fireEvent.click(removeButton);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        author: null,
        cursor: null,
      }),
    );
  });

  it("renders applied badges below the search input row", () => {
    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ author: "dev@example.com" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    const inputWrap = screen.getByRole("textbox", { name: "Search query" }).closest(".integrated-search-input-wrap");
    const badgesRow = screen.getByRole("button", { name: "Open filters for By dev@example.com" }).closest(".integrated-search-badges");

    expect(inputWrap).not.toBeNull();
    expect(badgesRow).not.toBeNull();
    expect(
      inputWrap!.compareDocumentPosition(badgesRow!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens the filters panel when a badge is clicked", async () => {
    const user = userEvent.setup();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ author: "dev@example.com" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open filters for By dev@example.com" }));

    expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Author" })).toHaveValue("dev@example.com");
  });

  it("derives quick-range preset from UTC calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T01:30:00Z"));

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ from: "2026-02-27", to: "2026-03-05" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("combobox", { name: "Quick range" })).toHaveValue("7d");
    vi.useRealTimers();
  });

  it("applies date presets using UTC date boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T01:30:00Z"));
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery()}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Quick range" }), {
      target: { value: "7d" },
    });

    expect(onApply).toHaveBeenCalled();
    const latest = onApply.mock.calls.at(-1)?.[0] as Record<string, string | null> | undefined;
    expect(latest?.from).toBe("2026-02-27");
    expect(latest?.to).toBe("2026-03-05");
    vi.useRealTimers();
  });

  it("shows mainline controls only for series scope and applies mainline badge state", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="series"
        query={makeQuery()}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const hasDiffToggle = screen.getByRole("group", { name: "Has diff filter" });
    expect(
      within(hasDiffToggle)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["No", "Any", "Yes"]);
    expect(
      within(hasDiffToggle)
        .getAllByRole("button")
        .every((button) => button.querySelector("svg")),
    ).toBe(true);
    const mainlineToggle = screen.getByRole("group", { name: "Merge status filter" });
    expect(mainlineToggle).toBeInTheDocument();
    expect(
      within(mainlineToggle)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["No", "Any", "Yes"]);
    expect(
      within(mainlineToggle)
        .getAllByRole("button")
        .every((button) => button.querySelector("svg")),
    ).toBe(true);
    await user.click(within(mainlineToggle).getByRole("button", { name: "Yes" }));

    expect(onApply).toHaveBeenCalled();
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        merged: "true",
      }),
    );
  });

  it("does not render the redundant sort dropdown in the filters panel", async () => {
    const user = userEvent.setup();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ sort: "date_desc" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.queryByRole("combobox", { name: "Sort type" })).not.toBeInTheDocument();
  });

  it("commits non-author composer filters inline", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="series"
        query={makeQuery()}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search query" });
    await user.type(searchInput, "mainline:yes ");

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        q: null,
        merged: "true",
      }),
    );
    expect(searchInput).toHaveValue("");
  });

  it("uses merged and unmerged badge copy for series merge status", () => {
    const { rerender } = render(
      <IntegratedSearchBar
        scope="series"
        query={makeQuery({ merged: "true" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Open filters for Merged" })).toBeInTheDocument();

    rerender(
      <IntegratedSearchBar
        scope="series"
        query={makeQuery({ merged: "false" })}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Open filters for Unmerged" })).toBeInTheDocument();
  });

  it("keeps typed author tokens as plain text instead of applying an author filter", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery()}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search query" });
    await user.type(searchInput, "author:dev@example.com ");

    expect(onApply).not.toHaveBeenCalled();
    expect(searchInput).toHaveValue("author:dev@example.com ");
  });

  it("does not show inline DSL help copy in the filters panel", async () => {
    const user = userEvent.setup();

    render(
      <IntegratedSearchBar
        scope="series"
        query={makeQuery()}
        defaults={defaults}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.queryByText(/Type filters inline/i)).not.toBeInTheDocument();
  });

  it("removes the last applied filter with backspace when the composer is empty", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <IntegratedSearchBar
        scope="thread"
        query={makeQuery({ author: "dev@example.com" })}
        defaults={defaults}
        onApply={onApply}
        onClear={() => {}}
      />,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search query" });
    await user.click(searchInput);
    await user.keyboard("[Backspace]");

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        author: null,
      }),
    );
  });
});

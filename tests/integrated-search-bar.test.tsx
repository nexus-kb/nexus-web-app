import { act, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("combobox", { name: "Sort type" })).toHaveValue("recent");
  });

  it("animates badge removal before deleting", () => {
    vi.useFakeTimers();
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

    const badge = screen.getByText("By dev@example.com").closest(".integrated-search-badge");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("is-removing");

    act(() => {
      vi.advanceTimersByTime(140);
    });

    expect(screen.queryByText("By dev@example.com")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

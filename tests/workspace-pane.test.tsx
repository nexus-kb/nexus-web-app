import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { WorkspacePane } from "@/components/workspace-pane";

describe("WorkspacePane", () => {
  it("renders configurable title, subtitle, meta, and controls", () => {
    const panelRef = createRef<HTMLDivElement>();

    render(
      <WorkspacePane
        sectionClassName="thread-list-pane"
        ariaLabel="Pane sample"
        panelRef={panelRef}
        title="THREADS"
        subtitle="lkml"
        subtitleTitle="lkml"
        meta={<p className="pane-meta">42 rows</p>}
        controls={<button type="button">Sort</button>}
      >
        <div>Pane body</div>
      </WorkspacePane>,
    );

    const pane = screen.getByRole("region", { name: "Pane sample" });
    const scope = within(pane);

    expect(panelRef.current).toBe(pane);
    expect(pane).toHaveClass("thread-list-pane");
    expect(scope.getByText("THREADS")).toBeInTheDocument();
    expect(scope.getByRole("heading", { name: "lkml" })).toHaveAttribute("title", "lkml");
    expect(scope.getByText("42 rows")).toBeInTheDocument();
    expect(scope.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    expect(scope.getByText("Pane body")).toBeInTheDocument();
  });

  it("omits subtitle strip when subtitle is not provided", () => {
    render(
      <WorkspacePane sectionClassName="thread-detail-pane" title="DETAIL">
        <div>Body only</div>
      </WorkspacePane>,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("DETAIL")).toBeInTheDocument();
    expect(screen.getByText("Body only")).toBeInTheDocument();
  });
});

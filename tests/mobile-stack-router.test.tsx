import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MobileStackRouter } from "@/components/mobile-stack-router";

describe("MobileStackRouter", () => {
  it("renders list or detail pane based on drilldown state", async () => {
    const user = userEvent.setup();
    const openNav = vi.fn();
    const closeNav = vi.fn();
    const backToList = vi.fn();

    const { rerender } = render(
      <MobileStackRouter
        showDetail={false}
        navOpen={false}
        onOpenNav={openNav}
        onCloseNav={closeNav}
        onBackToList={backToList}
        leftRail={<div>Nav</div>}
        listPane={<div>List Pane</div>}
        detailPane={<div>Detail Pane</div>}
      />, 
    );

    expect(screen.getByText("List Pane")).toBeInTheDocument();
    expect(screen.queryByText("Detail Pane")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(openNav).toHaveBeenCalled();

    rerender(
      <MobileStackRouter
        showDetail
        navOpen={false}
        onOpenNav={openNav}
        onCloseNav={closeNav}
        onBackToList={backToList}
        leftRail={<div>Nav</div>}
        listPane={<div>List Pane</div>}
        detailPane={<div>Detail Pane</div>}
      />,
    );

    expect(screen.getByText("Detail Pane")).toBeInTheDocument();
    expect(screen.queryByText("List Pane")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← Threads" }));
    expect(backToList).toHaveBeenCalled();
  });
});

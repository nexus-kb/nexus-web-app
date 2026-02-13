"use client";

import type { PointerEventHandler, ReactNode } from "react";
import { PaneResizer } from "@/components/pane-resizer";

interface AppShellProps {
  navCollapsed: boolean;
  centerWidth: number;
  leftRail: ReactNode;
  centerPane: ReactNode;
  detailPane: ReactNode;
  onCenterResizeStart: PointerEventHandler<HTMLDivElement>;
}

export function AppShell({
  navCollapsed,
  centerWidth,
  leftRail,
  centerPane,
  detailPane,
  onCenterResizeStart,
}: AppShellProps) {
  return (
    <div className="app-shell desktop-only">
      <div
        className="left-shell"
        style={{ width: navCollapsed ? "56px" : "248px" }}
        data-nav-collapsed={navCollapsed ? "true" : "false"}
      >
        {leftRail}
      </div>

      <div className="center-shell" style={{ width: `${centerWidth}px` }}>
        {centerPane}
      </div>

      <PaneResizer onPointerDown={onCenterResizeStart} label="Resize thread list and detail panes" />

      <div className="detail-shell">{detailPane}</div>
    </div>
  );
}

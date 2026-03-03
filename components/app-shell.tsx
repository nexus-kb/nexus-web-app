"use client";

import type { PointerEventHandler, ReactNode } from "react";
import { AppFrame } from "@nexus/design-system";

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
    <AppFrame
      navCollapsed={navCollapsed}
      centerWidth={centerWidth}
      leftRail={leftRail}
      centerPane={centerPane}
      detailPane={detailPane}
      onCenterResizeStart={onCenterResizeStart}
      resizeLabel="Resize thread list and detail panes"
    />
  );
}

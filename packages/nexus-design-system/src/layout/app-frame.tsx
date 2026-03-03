"use client";

import type { PointerEventHandler, ReactNode } from "react";
import { PaneResizer } from "./pane-resizer";

interface AppFrameProps {
  navCollapsed: boolean;
  centerWidth: number;
  leftRail: ReactNode;
  centerPane: ReactNode;
  detailPane: ReactNode;
  onCenterResizeStart: PointerEventHandler<HTMLDivElement>;
  resizeLabel?: string;
  resizable?: boolean;
}

export function AppFrame({
  navCollapsed,
  centerWidth,
  leftRail,
  centerPane,
  detailPane,
  onCenterResizeStart,
  resizeLabel = "Resize center and detail panes",
  resizable = true,
}: AppFrameProps) {
  return (
    <div className="ds-app-frame">
      <div className="ds-shell-panel ds-left-shell" data-nav-collapsed={navCollapsed ? "true" : "false"}>
        {leftRail}
      </div>

      <div className="ds-shell-panel ds-center-shell" style={{ width: `${centerWidth}px` }}>
        {centerPane}
      </div>

      {resizable ? (
        <PaneResizer onPointerDown={onCenterResizeStart} label={resizeLabel} />
      ) : (
        <div className="ds-pane-spacer" aria-hidden="true" />
      )}

      <div className="ds-shell-panel ds-detail-shell">{detailPane}</div>
    </div>
  );
}

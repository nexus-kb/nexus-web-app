"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const safeWidth = Number.isFinite(centerWidth) ? Math.max(340, Math.min(780, Math.trunc(centerWidth))) : 420;
    document.documentElement.style.setProperty("--ds-center-pane-width", `${safeWidth}px`);
  }, [centerWidth]);

  return (
    <div className="ds-app-frame">
      <div className="ds-shell-panel ds-left-shell" data-nav-collapsed={navCollapsed ? "true" : "false"}>
        {leftRail}
      </div>

      <div className="ds-shell-panel ds-center-shell">
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

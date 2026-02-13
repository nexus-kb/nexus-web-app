"use client";

import type { PointerEventHandler } from "react";

interface PaneResizerProps {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  label: string;
}

export function PaneResizer({ onPointerDown, label }: PaneResizerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      className="pane-resizer"
      onPointerDown={onPointerDown}
    />
  );
}

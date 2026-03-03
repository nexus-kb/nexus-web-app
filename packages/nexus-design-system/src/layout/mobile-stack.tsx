"use client";

import type { ReactNode } from "react";
import { Button } from "../primitives/button";

interface MobileStackProps {
  title: string;
  showDetail: boolean;
  navOpen: boolean;
  onOpenNav: () => void;
  onCloseNav: () => void;
  onBackToList: () => void;
  leftRail: ReactNode;
  listPane: ReactNode;
  detailPane: ReactNode;
}

export function MobileStack({
  title,
  showDetail,
  navOpen,
  onOpenNav,
  onCloseNav,
  onBackToList,
  leftRail,
  listPane,
  detailPane,
}: MobileStackProps) {
  return (
    <div className="ds-mobile-stack">
      <header className="ds-mobile-header">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="ds-mobile-menu"
          onClick={onOpenNav}
          aria-label="Open navigation"
        >
          ☰
        </Button>
        {showDetail ? (
          <Button type="button" variant="ghost" size="sm" onClick={onBackToList}>
            ← {title}
          </Button>
        ) : (
          <span className="ds-mobile-title">{title}</span>
        )}
      </header>

      <div className="ds-mobile-main">{showDetail ? detailPane : listPane}</div>

      {navOpen ? (
        <div className="ds-mobile-nav-overlay" onClick={onCloseNav} role="presentation">
          <div className="ds-mobile-nav-sheet" onClick={(event) => event.stopPropagation()}>
            {leftRail}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

interface MobileStackRouterProps {
  showDetail: boolean;
  navOpen: boolean;
  onOpenNav: () => void;
  onCloseNav: () => void;
  onBackToList: () => void;
  leftRail: ReactNode;
  listPane: ReactNode;
  detailPane: ReactNode;
}

export function MobileStackRouter({
  showDetail,
  navOpen,
  onOpenNav,
  onCloseNav,
  onBackToList,
  leftRail,
  listPane,
  detailPane,
}: MobileStackRouterProps) {
  return (
    <div className="mobile-stack">
      <header className="mobile-header">
        <button type="button" className="icon-button" onClick={onOpenNav} aria-label="Open navigation">
          ☰
        </button>
        {showDetail ? (
          <button type="button" className="ghost-button" onClick={onBackToList}>
            ← Threads
          </button>
        ) : (
          <span className="mobile-title">Threads</span>
        )}
      </header>

      <div className="mobile-main">{showDetail ? detailPane : listPane}</div>

      {navOpen ? (
        <div className="mobile-nav-overlay" onClick={onCloseNav} role="presentation">
          <div className="mobile-nav-sheet" onClick={(event) => event.stopPropagation()}>
            {leftRail}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { MobileStack } from "@nexus/design-system";
import type { ReactNode } from "react";

interface MobileStackRouterProps {
  title?: string;
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
  title = "Threads",
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
    <MobileStack
      title={title}
      showDetail={showDetail}
      navOpen={navOpen}
      onOpenNav={onOpenNav}
      onCloseNav={onCloseNav}
      onBackToList={onBackToList}
      leftRail={leftRail}
      listPane={listPane}
      detailPane={detailPane}
    />
  );
}

"use client";

import type { ReactNode, RefObject } from "react";
import { cn } from "../utils/cn";

export interface PaneFrameProps {
  className?: string;
  ariaLabel?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  tabIndex?: number;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
  contextTitle?: string;
  contextClassName?: string;
  toolbar?: ReactNode;
  toolbarClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  children: ReactNode;
}

export function PaneFrame({
  className,
  ariaLabel,
  panelRef,
  tabIndex = -1,
  title,
  meta,
  actions,
  context,
  contextTitle,
  contextClassName,
  toolbar,
  toolbarClassName,
  bodyClassName,
  footer,
  footerClassName,
  children,
}: PaneFrameProps) {
  return (
    <section className={cn("ds-pane", className)} aria-label={ariaLabel} ref={panelRef} tabIndex={tabIndex}>
      <header className="ds-pane-header">
        <div className="ds-pane-header-main">
          <p className="ds-pane-kicker">{title}</p>
          {meta ? <div className="ds-pane-meta">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="ds-pane-actions" aria-label={`${title} controls`}>
            {actions}
          </div>
        ) : null}
      </header>

      {context ? (
        <div className={cn("ds-pane-context", contextClassName)}>
          <h2 className="ds-pane-context-title" title={contextTitle}>
            {context}
          </h2>
        </div>
      ) : null}

      {toolbar ? <div className={cn("ds-pane-toolbar", toolbarClassName)}>{toolbar}</div> : null}

      <div className={cn("ds-pane-body", bodyClassName)}>{children}</div>

      {footer ? <footer className={cn("ds-pane-footer", footerClassName)}>{footer}</footer> : null}
    </section>
  );
}

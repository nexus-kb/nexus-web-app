import { PaneFrame } from "@nexus/design-system";
import type { ReactNode, RefObject } from "react";

interface WorkspacePaneProps {
  sectionClassName: string;
  bodyClassName?: string;
  ariaLabel?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  tabIndex?: number;
  title: ReactNode;
  meta?: ReactNode;
  controls?: ReactNode;
  controlsAriaLabel?: string;
  subtitle?: ReactNode;
  subtitleTitle?: string;
  subtitleClassName?: string;
  children: ReactNode;
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter((value) => Boolean(value && value.trim().length > 0)).join(" ");
}

export function WorkspacePane({
  sectionClassName,
  bodyClassName,
  ariaLabel,
  panelRef,
  tabIndex = -1,
  title,
  meta,
  controls,
  controlsAriaLabel,
  subtitle,
  subtitleTitle,
  subtitleClassName,
  children,
}: WorkspacePaneProps) {
  return (
    <PaneFrame
      className={sectionClassName}
      ariaLabel={ariaLabel}
      panelRef={panelRef}
      tabIndex={tabIndex}
      title={title}
      meta={meta}
      actions={
        controls ? (
          <div className="pane-structured-controls" aria-label={controlsAriaLabel}>
            {controls}
          </div>
        ) : null
      }
      context={
        subtitle ? (
          <span
            className={joinClasses("pane-subtitle-heading", subtitleClassName)}
            title={subtitleTitle}
          >
            {subtitle}
          </span>
        ) : null
      }
      contextTitle={subtitleTitle}
      bodyClassName={bodyClassName}
    >
      {children}
    </PaneFrame>
  );
}

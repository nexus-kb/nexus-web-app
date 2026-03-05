import type { ReactNode, RefObject } from "react";

interface WorkspacePaneProps {
  sectionClassName: string;
  ariaLabel?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  tabIndex?: number;
  title: ReactNode;
  meta?: ReactNode;
  controls?: ReactNode;
  controlsAriaLabel?: string;
  headerClassName?: string;
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
  ariaLabel,
  panelRef,
  tabIndex = -1,
  title,
  meta,
  controls,
  controlsAriaLabel,
  headerClassName,
  subtitle,
  subtitleTitle,
  subtitleClassName,
  children,
}: WorkspacePaneProps) {
  return (
    <section className={sectionClassName} aria-label={ariaLabel} ref={panelRef} tabIndex={tabIndex}>
      <header className={joinClasses("pane-header pane-structured-header", headerClassName)}>
        <div className="pane-structured-main">
          <p className="pane-kicker">{title}</p>
          {meta ? <div className="pane-structured-meta">{meta}</div> : null}
        </div>
        {controls ? (
          <div className="pane-structured-controls" aria-label={controlsAriaLabel}>
            {controls}
          </div>
        ) : null}
      </header>
      {subtitle ? (
        <div className="pane-subtitle-strip">
          <h2
            className={joinClasses("pane-subtitle-heading", subtitleClassName)}
            title={subtitleTitle}
          >
            {subtitle}
          </h2>
        </div>
      ) : null}
      {children}
    </section>
  );
}

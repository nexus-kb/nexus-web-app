"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

interface DisclosureCardProps extends HTMLAttributes<HTMLElement> {
  heading: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  expanded?: boolean;
  selected?: boolean;
  onToggleClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  headerProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "onClick" | "type">;
  bodyId?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function DisclosureCard({
  className,
  heading,
  subtitle,
  meta,
  trailing,
  expanded = false,
  selected = false,
  onToggleClick,
  headerProps,
  bodyId,
  bodyClassName,
  children,
  ...props
}: DisclosureCardProps) {
  return (
    <article
      className={cn(
        "ds-disclosure-card",
        expanded && "is-expanded",
        selected && "is-selected",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        className="ds-disclosure-trigger"
        onClick={onToggleClick}
        aria-expanded={expanded}
        {...headerProps}
      >
        <div className="ds-disclosure-main">
          <p className="ds-disclosure-title">{heading}</p>
          {subtitle ? <p className="ds-disclosure-subtitle">{subtitle}</p> : null}
          {meta ? <div className="ds-disclosure-meta">{meta}</div> : null}
        </div>
        {trailing ? <div className="ds-disclosure-trailing">{trailing}</div> : null}
      </button>

      {expanded && children ? <div id={bodyId} className={cn("ds-disclosure-body", bodyClassName)}>{children}</div> : null}
    </article>
  );
}

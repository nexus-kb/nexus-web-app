"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

interface ListRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  heading: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  selected?: boolean;
  keyboardActive?: boolean;
}

export function ListRow({
  className,
  heading,
  subtitle,
  meta,
  badge,
  selected = false,
  keyboardActive = false,
  type = "button",
  ...props
}: ListRowProps) {
  return (
    <button
      type={type}
      className={cn(
        "ds-list-row",
        selected && "is-selected",
        keyboardActive && "is-keyboard",
        className,
      )}
      {...props}
    >
      <div className="ds-list-row-main">
        <p className="ds-list-row-title">{heading}</p>
        {subtitle ? <p className="ds-list-row-subtitle">{subtitle}</p> : null}
        {meta ? <p className="ds-list-row-meta">{meta}</p> : null}
      </div>
      {badge ? <div className="ds-list-row-badge">{badge}</div> : null}
    </button>
  );
}

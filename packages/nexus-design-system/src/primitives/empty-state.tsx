"use client";

import { cn } from "../utils/cn";

interface EmptyStateProps {
  kicker: string;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ kicker, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("ds-empty-state", className)}>
      <p className="ds-empty-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

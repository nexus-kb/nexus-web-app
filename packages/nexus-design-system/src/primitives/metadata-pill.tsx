"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export type MetadataPillVariant = "default" | "selected" | "muted";

export interface MetadataPillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: MetadataPillVariant;
}

export function MetadataPill({
  className,
  variant = "default",
  ...props
}: MetadataPillProps) {
  return <span className={cn("ds-metadata-pill", `ds-metadata-pill-${variant}`, className)} {...props} />;
}

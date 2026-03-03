"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ds-badge", className)} {...props} />;
}

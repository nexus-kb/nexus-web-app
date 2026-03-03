"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("ds-select", className)} {...props} />;
}

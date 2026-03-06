"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function CodeBlock({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return <pre className={cn("ds-code-block", className)} {...props} />;
}

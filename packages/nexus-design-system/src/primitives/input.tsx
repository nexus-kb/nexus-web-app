"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("ds-input", className)} {...props} />;
}

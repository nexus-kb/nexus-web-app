"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function IconButton({
  className,
  active = false,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn("ds-btn", "ds-btn-ghost", "ds-btn-icon", active && "is-active", className)}
      {...props}
    />
  );
}

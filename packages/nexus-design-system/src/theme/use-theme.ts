"use client";

import { useContext } from "react";
import { ThemeContext } from "./theme-provider";

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return {
    themeMode: context.themeMode,
    resolvedTheme: context.resolvedTheme,
    setThemeMode: context.setThemeMode,
    cycleThemeMode: context.cycleThemeMode,
  };
}

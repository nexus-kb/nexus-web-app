"use client";

import { useContext } from "react";
import { ThemeContext } from "./theme-provider";

export function usePreferences() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("usePreferences must be used within ThemeProvider");
  }

  return {
    densityMode: context.densityMode,
    setDensityMode: context.setDensityMode,
    toggleDensityMode: context.toggleDensityMode,
    navCollapsed: context.navCollapsed,
    setNavCollapsed: context.setNavCollapsed,
    toggleNavCollapsed: context.toggleNavCollapsed,
  };
}

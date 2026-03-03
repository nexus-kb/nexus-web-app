"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEYS = {
  theme: "nexus.theme",
  nav: "nexus.nav",
} as const;

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  navCollapsed: boolean;
  setNavCollapsed: (collapsed: boolean) => void;
  toggleNavCollapsed: () => void;
}

function parseThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function parseNavCollapsed(value: string | null | undefined): boolean {
  if (value === "true" || value === "collapsed") {
    return true;
  }
  return false;
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readInitialThemeMode(): ThemeMode {
  if (typeof document !== "undefined") {
    const datasetMode = parseThemeMode(document.documentElement.dataset.themeMode);
    if (
      datasetMode !== "system" ||
      document.documentElement.dataset.themeMode === "system"
    ) {
      return datasetMode;
    }
  }

  if (typeof window !== "undefined") {
    return parseThemeMode(window.localStorage.getItem(STORAGE_KEYS.theme));
  }

  return "system";
}

function readInitialNavCollapsed(): boolean {
  if (typeof document !== "undefined") {
    const datasetNav = document.documentElement.dataset.navCollapsed;
    if (datasetNav === "true" || datasetNav === "false") {
      return datasetNav === "true";
    }
  }

  if (typeof window !== "undefined") {
    return parseNavCollapsed(window.localStorage.getItem(STORAGE_KEYS.nav));
  }

  return false;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readInitialThemeMode());
  const [navCollapsed, setNavCollapsedState] = useState<boolean>(() => readInitialNavCollapsed());
  const [, setSystemThemeRevision] = useState(0);
  const resolvedTheme: ResolvedTheme = themeMode === "system" ? systemTheme() : themeMode;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setSystemThemeRevision((prev) => prev + 1);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.dataset.themeMode = themeMode;
    root.dataset.theme = resolvedTheme;

    window.localStorage.setItem(STORAGE_KEYS.theme, themeMode);
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    document.documentElement.dataset.navCollapsed = navCollapsed ? "true" : "false";
    window.localStorage.setItem(
      STORAGE_KEYS.nav,
      navCollapsed ? "collapsed" : "expanded",
    );
  }, [navCollapsed]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const cycleThemeMode = useCallback(() => {
    setThemeModeState((prev) =>
      prev === "system" ? "light" : prev === "light" ? "dark" : "system",
    );
  }, []);

  const setNavCollapsed = useCallback((collapsed: boolean) => {
    setNavCollapsedState(collapsed);
  }, []);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsedState((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      cycleThemeMode,
      navCollapsed,
      setNavCollapsed,
      toggleNavCollapsed,
    }),
    [
      cycleThemeMode,
      navCollapsed,
      resolvedTheme,
      setNavCollapsed,
      setThemeMode,
      themeMode,
      toggleNavCollapsed,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

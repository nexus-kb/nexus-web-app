export type ThemeMode = "system" | "light" | "dark";
export type NavMode = "expanded" | "collapsed";

export interface PaneLayoutState {
  centerWidth: number;
}

export const STORAGE_KEYS = {
  theme: "nexus.theme",
  nav: "nexus.nav",
  paneLayout: "nexus.panes",
} as const;

export function parseThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function parseNavMode(value: string | null | undefined): NavMode {
  if (value === "collapsed") {
    return "collapsed";
  }
  return "expanded";
}

export function resolveVisualTheme(themeMode: ThemeMode): "light" | "dark" {
  if (themeMode === "light" || themeMode === "dark") {
    return themeMode;
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function applyVisualTheme(themeMode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  const visualTheme = resolveVisualTheme(themeMode);
  document.documentElement.dataset.theme = visualTheme;
}

export function parsePaneLayout(value: string | null): PaneLayoutState {
  if (!value) {
    return { centerWidth: 420 };
  }

  try {
    const parsed = JSON.parse(value) as PaneLayoutState;
    if (Number.isFinite(parsed.centerWidth)) {
      return {
        centerWidth: Math.max(320, Math.min(720, parsed.centerWidth)),
      };
    }
  } catch {
    // fall through to default
  }

  return { centerWidth: 420 };
}

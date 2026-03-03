export type ThemeMode = "system" | "light" | "dark";
export type NavMode = "expanded" | "collapsed";
export type DensityMode = "comfortable" | "compact";

export interface PaneLayoutState {
  centerWidth: number;
}

export const DEFAULT_CENTER_WIDTH = 420;
export const MIN_CENTER_WIDTH = 340;
export const MAX_CENTER_WIDTH = 780;

export const STORAGE_KEYS = {
  theme: "nexus.theme",
  nav: "nexus.nav",
  density: "nexus.density",
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

export function parseDensityMode(value: string | null | undefined): DensityMode {
  if (value === "compact") {
    return "compact";
  }
  return "comfortable";
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
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(visualTheme);
  root.style.colorScheme = visualTheme;
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const fromDataset = parseThemeMode(document.documentElement.dataset.themeMode);
  if (fromDataset !== "system" || document.documentElement.dataset.themeMode === "system") {
    return fromDataset;
  }

  return parseThemeMode(localStorage.getItem(STORAGE_KEYS.theme));
}

export function getStoredNavCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const fromDataset = document.documentElement.dataset.navCollapsed;
  if (fromDataset === "true") {
    return true;
  }
  if (fromDataset === "false") {
    return false;
  }

  return parseNavMode(localStorage.getItem(STORAGE_KEYS.nav)) === "collapsed";
}

export function getStoredDensityMode(): DensityMode {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const fromDataset = parseDensityMode(document.documentElement.dataset.densityMode);
  if (fromDataset !== "comfortable" || document.documentElement.dataset.densityMode === "comfortable") {
    return fromDataset;
  }

  return parseDensityMode(localStorage.getItem(STORAGE_KEYS.density));
}

export function persistThemeMode(themeMode: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.theme, themeMode);
  document.documentElement.dataset.themeMode = themeMode;
  applyVisualTheme(themeMode);
}

export function persistNavCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.nav, collapsed ? "collapsed" : "expanded");
  document.documentElement.dataset.navCollapsed = collapsed ? "true" : "false";
}

export function persistDensityMode(mode: DensityMode): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.density, mode);
  document.documentElement.dataset.densityMode = mode;
}

export function clampCenterWidth(value: number): number {
  return Math.max(MIN_CENTER_WIDTH, Math.min(MAX_CENTER_WIDTH, Math.trunc(value)));
}

export function parsePaneLayout(value: string | null): PaneLayoutState {
  if (!value) {
    return { centerWidth: DEFAULT_CENTER_WIDTH };
  }

  try {
    const parsed = JSON.parse(value) as PaneLayoutState;
    if (Number.isFinite(parsed.centerWidth)) {
      return {
        centerWidth: clampCenterWidth(parsed.centerWidth),
      };
    }
  } catch {
    // fall through to default
  }

  return { centerWidth: DEFAULT_CENTER_WIDTH };
}

export function applyCenterPaneWidth(centerWidth: number): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.style.setProperty("--ds-center-pane-width", `${clampCenterWidth(centerWidth)}px`);
}

export function getStoredCenterWidth(): number {
  if (typeof document !== "undefined") {
    const cssValue = document.documentElement.style.getPropertyValue("--ds-center-pane-width").trim();
    if (cssValue.endsWith("px")) {
      const parsed = Number(cssValue.slice(0, -2));
      if (Number.isFinite(parsed)) {
        return clampCenterWidth(parsed);
      }
    }
  }

  if (typeof window !== "undefined") {
    return parsePaneLayout(localStorage.getItem(STORAGE_KEYS.paneLayout)).centerWidth;
  }

  return DEFAULT_CENTER_WIDTH;
}

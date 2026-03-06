import type { Metadata } from "next";
import { ThemeProvider } from "@nexus/design-system";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";
import "flatpickr/dist/flatpickr.min.css";

const PREFERENCES_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const root = document.documentElement;
    const desktopMediaQuery = "(min-width: 1024px)";

    const parseCenterWidth = (value) => {
      if (!value) {
        return null;
      }

      try {
        const parsed = JSON.parse(value);
        const width = Number(parsed?.centerWidth);
        if (!Number.isFinite(width)) {
          return null;
        }

        return Math.max(340, Math.min(780, Math.trunc(width)));
      } catch {
        return null;
      }
    };

    const themeModeRaw = localStorage.getItem("nexus.theme");
    const themeMode =
      themeModeRaw === "light" || themeModeRaw === "dark" || themeModeRaw === "system"
        ? themeModeRaw
        : "system";
    const visualTheme =
      themeMode === "dark"
        ? "dark"
        : themeMode === "light"
          ? "light"
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

    root.dataset.themeMode = themeMode;
    root.classList.remove("light", "dark");
    root.classList.add(visualTheme);
    root.style.colorScheme = visualTheme;

    const navRaw = localStorage.getItem("nexus.nav");
    root.dataset.navCollapsed = navRaw === "collapsed" ? "true" : "false";

    const pathname = window.location.pathname;
    let centerWidth = 420;

    if (pathname.startsWith("/threads")) {
      centerWidth = parseCenterWidth(localStorage.getItem("nexus.panes")) ?? 420;
    }

    root.style.setProperty("--ds-center-pane-width", String(centerWidth) + "px");
    root.dataset.viewport = window.matchMedia(desktopMediaQuery).matches ? "desktop" : "mobile";
  } catch {
    // Ignore storage access errors.
  }
})();
`;

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Nexus KB",
  description: "Thread-first kernel mailing list workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme-mode="system"
      data-nav-collapsed="false"
      data-viewport="desktop"
      className="light"
    >
      <head>
        <script
          id="nexus-preferences-bootstrap"
          dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

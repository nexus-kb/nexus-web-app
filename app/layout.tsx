import type { Metadata } from "next";
import { ThemeProvider } from "@nexus/design-system";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";
import "flatpickr/dist/flatpickr.min.css";

const PREFERENCES_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const root = document.documentElement;
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
  } catch {
    // Ignore storage access errors.
  }
})();
`;

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

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
      className="light"
    >
      <head>
        <script
          id="nexus-preferences-bootstrap"
          dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

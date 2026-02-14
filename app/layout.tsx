import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

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
    root.dataset.theme = visualTheme;

    const navRaw = localStorage.getItem("nexus.nav");
    root.dataset.navCollapsed = navRaw === "collapsed" ? "true" : "false";
  } catch {
    // Ignore storage access errors.
  }
})();
`;

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
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
      data-theme="light"
      data-theme-mode="system"
      data-nav-collapsed="false"
    >
      <head>
        <script
          id="nexus-preferences-bootstrap"
          dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className={`${publicSans.variable} ${ibmPlexMono.variable}`}>{children}</body>
    </html>
  );
}

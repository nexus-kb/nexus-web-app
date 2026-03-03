"use client";

import { useEffect, useState } from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

export function useDesktopViewport(defaultIsDesktop = true): boolean {
  const [isDesktop, setIsDesktop] = useState(defaultIsDesktop);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    const update = () => {
      const nextIsDesktop = mediaQuery.matches;
      setIsDesktop(nextIsDesktop);
      document.documentElement.dataset.viewport = nextIsDesktop ? "desktop" : "mobile";
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

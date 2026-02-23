"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const NAVIGATION_EVENT = "nexus:navigation";

interface RouterNavigationOptions {
  scroll?: boolean;
}

interface RouterLike {
  push: (href: string, options?: RouterNavigationOptions) => void;
  replace: (href: string, options?: RouterNavigationOptions) => void;
}

interface LocationSnapshot {
  pathname: string;
  search: string;
}

const SERVER_SNAPSHOT: LocationSnapshot = { pathname: "/", search: "" };
let lastSnapshot: LocationSnapshot | null = null;

function getLocationSnapshot(): LocationSnapshot {
  if (typeof window === "undefined") {
    return SERVER_SNAPSHOT;
  }

  const pathname = window.location.pathname;
  const search = window.location.search;
  if (lastSnapshot && lastSnapshot.pathname === pathname && lastSnapshot.search === search) {
    return lastSnapshot;
  }

  lastSnapshot = { pathname, search };
  return lastSnapshot;
}

function subscribeLocationChange(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", listener);
  window.addEventListener(NAVIGATION_EVENT, listener);

  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(NAVIGATION_EVENT, listener);
  };
}

function publishLocationChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

function navigate(href: string, replace: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(href, window.location.origin);
  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextPath === currentPath) {
    publishLocationChange();
    return;
  }

  if (replace) {
    window.history.replaceState({}, "", nextPath);
  } else {
    window.history.pushState({}, "", nextPath);
  }

  publishLocationChange();
}

function useLocationSnapshot(): LocationSnapshot {
  return useSyncExternalStore(
    subscribeLocationChange,
    getLocationSnapshot,
    getLocationSnapshot,
  );
}

export function useRouter(): RouterLike {
  const push = useCallback((href: string) => {
    navigate(href, false);
  }, []);

  const replace = useCallback((href: string) => {
    navigate(href, true);
  }, []);

  return useMemo(
    () => ({
      push,
      replace,
    }),
    [push, replace],
  );
}

export function usePathname(): string {
  return useLocationSnapshot().pathname;
}

export function useSearchParams(): URLSearchParams {
  const snapshot = useLocationSnapshot();

  return useMemo(
    () => new URLSearchParams(snapshot.search),
    [snapshot.search],
  );
}

export function navigateTo(href: string, replace = false): void {
  navigate(href, replace);
}

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetNavigationMock } from "@/tests/mocks/navigation";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches:
        query.includes("prefers-color-scheme: dark") ||
        query.includes("min-width: 1024px"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

const originalApiBaseUrl = process.env.NEXUS_WEB_API_BASE_URL;

beforeEach(() => {
  localStorage.clear();
  resetNavigationMock();
  process.env.NEXUS_WEB_API_BASE_URL = "http://api.internal:3000";
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  if (originalApiBaseUrl == null) {
    delete process.env.NEXUS_WEB_API_BASE_URL;
    return;
  }
  process.env.NEXUS_WEB_API_BASE_URL = originalApiBaseUrl;
});

import { vi } from "vitest";

export const routerPushMock = vi.fn();
export const routerReplaceMock = vi.fn();

let pathnameValue = "/lkml/threads";
let searchParamsValue = new URLSearchParams();

export function setNavigationState(pathname: string, params?: URLSearchParams) {
  pathnameValue = pathname;
  searchParamsValue = params ?? new URLSearchParams();
}

export function resetNavigationMock() {
  routerPushMock.mockReset();
  routerReplaceMock.mockReset();
  pathnameValue = "/lkml/threads";
  searchParamsValue = new URLSearchParams();
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
  usePathname: () => pathnameValue,
  useSearchParams: () => searchParamsValue,
}));

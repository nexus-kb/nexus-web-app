import { vi } from "vitest";

export const routerPushMock = vi.fn();
export const routerReplaceMock = vi.fn();

let pathnameValue = "/threads/lkml";
let searchParamsValue = new URLSearchParams();

export function setNavigationState(pathname: string, params?: URLSearchParams) {
  pathnameValue = pathname;
  searchParamsValue = params ?? new URLSearchParams();
}

export function resetNavigationMock() {
  routerPushMock.mockReset();
  routerReplaceMock.mockReset();
  pathnameValue = "/threads/lkml";
  searchParamsValue = new URLSearchParams();
}

vi.mock("@/lib/ui/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
  usePathname: () => pathnameValue,
  useSearchParams: () => searchParamsValue,
}));

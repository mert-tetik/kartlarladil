import { vi } from "vitest";

export function useRouter() {
  return {
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  };
}

export function usePathname() {
  return "/";
}

export function useParams() {
  return {};
}

export function useSearchParams() {
  return new URLSearchParams();
}

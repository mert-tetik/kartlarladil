export const DEFAULT_AUTH_REDIRECT = "/card-draw";

const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  "/kart-cek": "/card-draw",
  "/kartlarim": "/my-cards",
  "/ogren": "/learn",
  "/ogrenilenler": "/learned",
  "/profil": "/profile",
};

export function getSafeNextPath(value: unknown, fallback = DEFAULT_AUTH_REDIRECT) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://local.app");
    const pathname = LEGACY_PATH_REDIRECTS[url.pathname] ?? url.pathname;

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

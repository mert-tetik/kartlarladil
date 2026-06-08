export const DEFAULT_AUTH_REDIRECT = "/kesfet";

export function getSafeNextPath(value: unknown, fallback = DEFAULT_AUTH_REDIRECT) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

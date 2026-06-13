import "server-only";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, normalizeLocale, getLocaleDirection } from "@/i18n/config";

export async function getServerLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function getServerTextDirection() {
  return getLocaleDirection(await getServerLocale());
}

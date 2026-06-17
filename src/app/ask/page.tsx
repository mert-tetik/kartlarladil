import { redirect } from "next/navigation";
import { getServerLocale } from "@/i18n/server";

export default async function AskIndexPage() {
  const locale = await getServerLocale();
  redirect(`/ask/${locale}`);
}

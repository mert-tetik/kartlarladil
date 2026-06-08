import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const config = getSupabaseBrowserConfig();

  return createBrowserClient(config.url, config.publishableKey);
}

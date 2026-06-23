import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function loadEnv(path) {
  const text = fs.readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      process.env[key] = value;
    }
  }
}

loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = "616d3923-3606-4825-a691-dc22fc226f65";

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CARD_SOURCE_KEYS = [
  "en:A1:word:about:adverb",
  "en:A1:word:above:adverb",
  "en:A1:word:across:adverb",
  "en:A1:word:action:noun",
  "en:A1:word:activity:noun",
  "en:A1:word:actor:noun",
  "en:A1:word:actress:noun",
  "en:A1:word:add:verb",
  "en:A1:word:address:noun",
  "en:A1:word:advice:noun",
];

async function main() {
  await supabase.from("user_cards").delete().eq("user_id", userId);

  const now = new Date().toISOString();
  const rows = CARD_SOURCE_KEYS.map((sourceKey) => ({
    user_id: userId,
    card_source_key: sourceKey,
    status: "active",
    correct_count: 0,
    added_at: now,
  }));

  const { error: insertError } = await supabase.from("user_cards").insert(rows);
  if (insertError) {
    console.error("Failed to insert cards:", insertError.message);
    process.exit(1);
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert({
    user_id: userId,
    display_name: "Visual Test",
    preferred_language_code: "en",
    preferred_ui_locale: "tr",
    preferred_tier: "A1",
    onboarding_completed: true,
    ai_practice_points: 0,
    chest_points: 0,
    theme: null,
    created_at: now,
    updated_at: now,
  });
  if (profileError) {
    console.error("Failed to upsert profile:", profileError.message);
    process.exit(1);
  }

  console.log("Seeded", rows.length, "cards and profile for user", userId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

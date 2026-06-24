import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, "utf8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = "visual-test@foxiesdeck.local";

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const user = existing?.users?.find((u) => u.email === email);

  if (!user) {
    console.error("Test user not found");
    process.exit(1);
  }

  const userId = user.id;

  const { error: cardsError } = await supabase.from("user_cards").delete().eq("user_id", userId);
  if (cardsError) {
    console.error("Failed to delete user_cards:", cardsError.message);
    process.exit(1);
  }

  const { error: attemptsError } = await supabase.from("practice_attempts").delete().eq("user_id", userId);
  if (attemptsError) {
    console.error("Failed to delete practice_attempts:", attemptsError.message);
    process.exit(1);
  }

  console.log("Reset inventory for test user:", userId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

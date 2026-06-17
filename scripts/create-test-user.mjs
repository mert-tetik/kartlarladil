import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const email = "visual-test@foxiesdeck.local";
const password = "VisualTest123!";

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const user = existing?.users?.find((u) => u.email === email);

  if (user) {
    console.log("User already exists:", user.id);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error("Failed to create user:", error.message);
    process.exit(1);
  }

  console.log("Created user:", data.user.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

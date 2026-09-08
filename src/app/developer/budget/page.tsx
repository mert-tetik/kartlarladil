import type { Metadata } from "next";
import { BudgetInterface } from "@/features/developer/components/budget-interface";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { getDeveloperBudgetItems } from "@/features/developer/developer-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DeveloperBudgetPage() {
  await requireDeveloperAdmin("/developer/budget");
  const items = await getDeveloperBudgetItems();
  return <BudgetInterface initialItems={items} />;
}

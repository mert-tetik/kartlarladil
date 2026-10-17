import type { Metadata } from "next";
import { VocabularyCatalog } from "@/features/developer/components/vocabulary-catalog";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vocabulary catalog | Developer workspace",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DeveloperVocabularyPage({ searchParams }: PageProps) {
  await requireDeveloperAdmin("/developer/vocabulary");
  return <VocabularyCatalog searchParams={await searchParams} />;
}

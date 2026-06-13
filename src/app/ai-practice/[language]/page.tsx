import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { LanguageFlag } from "@/components/language-flag";
import { buttonClassName } from "@/components/ui/button";
import { isLanguageCode } from "@/data/languages";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeCharacterSelection } from "@/features/ai-practice/components/ai-practice-character-selection";
import { createTranslator } from "@/i18n/dictionaries";
import { getLanguageDisplayName } from "@/i18n/labels";
import { getServerLocale } from "@/i18n/server";

type AiPracticeCharacterPageProps = {
  params: Promise<{ language: string }>;
};

export default async function AiPracticeCharacterPage({ params }: AiPracticeCharacterPageProps) {
  const { language: rawLanguage } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}`);

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const languageName = getLanguageDisplayName(rawLanguage, locale);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title={t("page.aiPractice.charactersTitle")}
        description={t("page.aiPractice.charactersDescription", { language: languageName })}
        action={
          <Link href="/ai-practice" className={buttonClassName("secondary", "sm")}>
            {t("common.back")}
          </Link>
        }
      />
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
        <LanguageFlag code={rawLanguage} />
        {languageName}
      </div>
      <div className="mt-6">
        <AiPracticeCharacterSelection language={rawLanguage} locale={locale} />
      </div>
    </section>
  );
}

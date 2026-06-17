import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Layers3, Search, Trophy } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { AskSection } from "@/app/components/ask-section";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { VOCABULARY_CARDS } from "@/data/cards";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageFlag } from "@/components/language-flag";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { AiPracticePreview } from "@/app/components/ai-practice-preview";
import { CollectionPreviewCard } from "@/app/components/collection-preview-card";
import { ReviewSection } from "@/features/reviews/components/review-section";
import { RANKS, TIER_POINTS } from "@/features/progress/progress-stats";
import { RankIcon } from "@/features/progress/rank-icons";
import { createTranslator } from "@/i18n/dictionaries";
import { formatNumber, formatPoints, getRankLabel, getTierLabel } from "@/i18n/labels";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo/metadata";
import { createOrganizationSchema, createWebSiteSchema } from "@/lib/seo/schema";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: APP_NAME,
    description: t("metadata.description"),
  });
}

type HeroCardFace = "front" | "back";

const previewCards = [
  pickPreviewCard("en", "A1"),
  pickPreviewCard("en", "B1"),
  pickPreviewCard("de", "C1"),
].filter((card): card is VocabularyCard => Boolean(card));

const heroBackdropCards = [
  pickPreviewCard("en", "A1"),
  pickPreviewCard("de", "A1"),
  pickPreviewCard("ru", "A1"),
  pickPreviewCard("fr", "B1"),
  pickPreviewCard("es", "B1"),
  pickPreviewCard("it", "B1"),
  pickPreviewCard("pt", "A2"),
  pickPreviewCard("nl", "A2"),
  pickPreviewCard("pl", "A2"),
  pickPreviewCard("ar", "C1"),
  pickPreviewCard("ja", "C1"),
  pickPreviewCard("zh-CN", "C1"),
].filter((card): card is VocabularyCard => Boolean(card));

const HERO_BACKDROP_SEQUENCE_REPEATS = 2;

export default async function Home() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const user = await getCurrentAuthUser();
  const existingReview = user ? await fetchExistingReview(user.id) : null;
  const featureItems = [
    {
      icon: Search,
      title: t("home.feature.discovery.title"),
      description: t("home.feature.discovery.description"),
    },
    {
      icon: Layers3,
      title: t("home.feature.inventory.title"),
      description: t("home.feature.inventory.description"),
    },
    {
      icon: Brain,
      title: t("home.feature.quiz.title"),
      description: t("home.feature.quiz.description"),
    },
  ];

  return (
    <>
      <JsonLd data={[createWebSiteSchema(), createOrganizationSchema()]} />
      <section className="relative isolate min-h-[88vh] overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-[0.74] brightness-125 contrast-125 saturate-125">
          <CardBackdrop />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_46%,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.58)_30%,rgba(15,23,42,0.26)_62%,rgba(2,6,23,0.22)_100%)]" />
        <div className="absolute inset-0 bg-slate-950/55 sm:hidden" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.84)_30%,rgba(0,0,0,0.38)_58%,rgba(0,0,0,0.14)_100%)] sm:block" />

        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex w-full flex-col items-center gap-8 lg:flex-row">
            <div className="order-1 flex shrink-0 items-center justify-center lg:order-none lg:w-[360px]">
              <Image
                src="/mascots/mascot1.png"
                alt=""
                width={360}
                height={380}
                className="h-auto w-56 sm:w-64 lg:w-80"
                priority
              />
            </div>
            <div className="order-2 max-w-3xl lg:order-none">
              <h1 className="font-display text-6xl font-semibold leading-none md:text-7xl">{t("home.hero.title")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">{t("home.hero.subtitle")}</p>
            <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
              <Link
                href="/card-draw"
                className={cn(
                  buttonClassName("primary", "lg", "bg-white text-slate-950 hover:bg-slate-200"),
                  "w-full justify-center sm:w-auto",
                )}
              >
                {t("home.hero.primaryCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/my-cards"
                className={cn(
                  buttonClassName("secondary", "lg", "border-white/20 bg-white/10 text-white hover:bg-white/20"),
                  "w-full justify-center sm:w-auto",
                )}
              >
                {t("home.hero.secondaryCta")}
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3" aria-label={t("home.hero.supportedLanguages")}>
              {LANGUAGES.map((language) => (
                <LanguageFlag key={language.code} code={language.code} className="h-6 w-9 border-0 bg-transparent" />
              ))}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="bg-brand">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          {featureItems.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="rounded-lg bg-white p-6 shadow-sm dark:bg-background">
                <Icon className="size-7 text-brand dark:text-white" aria-hidden="true" />
                <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-foreground-secondary">{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section data-collection-preview-section className="bg-slate-50 dark:bg-background">
        <div className="mx-auto grid w-full max-w-[1500px] items-center gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[140px_minmax(350px,0.75fr)_minmax(650px,1.25fr)] lg:gap-8 lg:px-8">
          <div className="hidden lg:flex lg:items-center lg:justify-center">
            <Image
              src="/mascots/mascot16.png"
              alt=""
              width={140}
              height={140}
              className="h-auto w-20"
            />
          </div>
          <div>
            <h2 className="font-display text-4xl font-semibold text-slate-950 dark:text-white">{t("home.collection.title")}</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-foreground-secondary">{t("home.collection.description")}</p>
            <div className="mt-8">
              <p className="text-sm font-semibold tracking-wide text-slate-950 uppercase dark:text-white">For 14 Languages</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {LANGUAGES.map((language) => (
                  <LanguageFlag
                    key={language.code}
                    code={language.code}
                    className="h-6 w-9 border-0 bg-transparent rounded-none"
                  />
                ))}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-2">
              {TIERS.map((tier) => (
                <div
                  key={tier}
                  className={cn("rounded-md border-0 p-3 text-center", TIER_STYLES[tier].accent)}
                >
                  <p className="text-sm font-bold text-white">{tier}</p>
                  <p className="mt-1 text-xs font-semibold text-white/90">{getTierLabel(tier, locale)}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-collection-preview-deck className="min-w-0 self-center">
            <div className="grid w-full grid-cols-2 items-center gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-5">
              {previewCards.map((card, index) => (
                <div key={card.id} data-collection-preview-card className={index === 2 ? "hidden sm:block" : undefined}>
                  <CollectionPreviewCard card={card} index={index} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["/mascots/mascot6.png", t("home.steps.one.title"), t("home.steps.one.description")],
              ["/mascots/mascot7.png", t("home.steps.two.title"), t("home.steps.two.description")],
              ["/mascots/mascot8.png", t("home.steps.three.title"), t("home.steps.three.description")],
            ].map(([mascot, title, description]) => (
              <article key={mascot} className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                <div className="relative h-14 w-14">
                  <Image src={mascot} alt="" fill sizes="56px" className="object-contain" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-points-rank-section className="border-y border-slate-200 bg-slate-50 dark:border-border dark:bg-background">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:px-8">
          <div>
            <div className="relative h-36 w-36">
              <Image src="/mascots/mascot9.png" alt="" fill sizes="144px" className="object-contain" />
            </div>
            <h2 className="mt-5 font-display text-4xl font-semibold text-slate-950 dark:text-white">{t("home.points.title")}</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-foreground-secondary">{t("home.points.description")}</p>
          </div>

          <div className="grid min-w-0 gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TIERS.map((tier) => (
                <div key={tier} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-background-card">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${TIER_STYLES[tier].text}`}>{tier}</span>
                    <span className={`size-2.5 rounded-full ${TIER_STYLES[tier].accent}`} aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{formatPoints(locale, TIER_POINTS[tier])}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-foreground-muted">{getTierLabel(tier, locale)}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5">
              {RANKS.map((rank) => (
                <div key={rank.id} className="flex flex-col items-center text-center">
                  <RankIcon
                    icon={rank.icon}
                    className="size-24 sm:size-28 md:size-32"
                    sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
                  />
                  <p
                    className="mt-3 max-w-full truncate px-1 text-sm font-semibold text-slate-950 dark:text-white"
                    title={getRankLabel(rank, locale)}
                  >
                    {getRankLabel(rank, locale)}
                  </p>
                  <p className="text-sm font-medium text-slate-500 dark:text-foreground-muted">{formatNumber(locale, rank.minPoints)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <AiPracticePreview />

      <AskSection
        title={t("home.ask.title")}
        description={t("home.ask.description")}
        cta={t("home.ask.cta")}
        href={`/ask/${locale}`}
      />

      <section className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Trophy className="size-6 text-amber-300" aria-hidden="true" />
              <h2 className="font-display text-3xl font-semibold">{t("home.cta.title")}</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{t("home.cta.description")}</p>
          </div>
          <Link href="/card-draw" className={buttonClassName("primary", "lg", "bg-white text-slate-950 hover:bg-slate-200")}>
            {t("nav.cardDraw")}
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <ReviewSection
        user={user}
        existingReview={existingReview}
        t={{
          title: t("home.review.title"),
          description: t("home.review.description"),
          ratingLabel: t("home.review.ratingLabel"),
          commentLabel: t("home.review.commentLabel"),
          commentPlaceholder: t("home.review.commentPlaceholder"),
          submit: t("home.review.submit"),
          loginRequired: t("home.review.loginRequired"),
          login: t("home.review.login"),
          success: t("home.review.success"),
          error: t("home.review.error"),
          invalidRating: t("home.review.invalidRating"),
        }}
      />
    </>
  );
}

async function fetchExistingReview(userId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    rating: data.rating as number,
    comment: (data.comment as string) ?? "",
  };
}

function CardBackdrop() {
  const faceSequence = createRandomFaceSequence(heroBackdropCards.length * HERO_BACKDROP_SEQUENCE_REPEATS);
  const randomizedBackTiers = createRandomBackTierSequence(faceSequence.filter((face) => face === "back").length);

  return (
    <div
      data-hero-card-backdrop
      aria-hidden="true"
      inert
      className="hero-card-backdrop pointer-events-none h-full overflow-hidden"
    >
      <div data-hero-card-backdrop-track className="hero-card-backdrop-track flex h-full w-max">
        {[0, 1].map((setIndex) => (
          <div
            key={setIndex}
            data-hero-card-backdrop-set
            className="grid h-full shrink-0 auto-cols-[var(--hero-card-width)] grid-flow-col content-center gap-x-[var(--hero-card-gap)] gap-y-[var(--hero-card-row-gap)] pr-[var(--hero-card-gap)] [grid-template-rows:repeat(2,max-content)]"
          >
            {renderHeroBackdropCards(faceSequence, randomizedBackTiers)}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderHeroBackdropCards(faceSequence: HeroCardFace[], randomizedBackTiers: Tier[]) {
  let backTierIndex = 0;

  return Array.from({ length: HERO_BACKDROP_SEQUENCE_REPEATS }, (_, sequenceIndex) =>
    heroBackdropCards.map((card, cardIndex) => {
      const sequenceFaceIndex = sequenceIndex * heroBackdropCards.length + cardIndex;
      const face = faceSequence[sequenceFaceIndex] ?? "front";
      const backDisplayTier = face === "back" ? randomizedBackTiers[backTierIndex++] : undefined;

      return (
        <div key={`${sequenceIndex}-${card.id}`} data-hero-card-backdrop-card className="w-full min-w-0">
          <VocabularyCardView card={card} initialFace={face} backDisplayTier={backDisplayTier} />
        </div>
      );
    }),
  );
}

function createRandomFaceSequence(count: number): HeroCardFace[] {
  const targetBackCount = Math.floor(count / 2);
  const shuffledIndexes = shuffleIndexes(count);
  const backIndexes = new Set(shuffledIndexes.slice(0, targetBackCount));
  const evenIndexes = Array.from({ length: count }, (_, index) => index).filter((index) => index % 2 === 0);
  const oddIndexes = Array.from({ length: count }, (_, index) => index).filter((index) => index % 2 === 1);

  ensureBackFaceInRow(backIndexes, evenIndexes, oddIndexes);
  ensureBackFaceInRow(backIndexes, oddIndexes, evenIndexes);

  return Array.from({ length: count }, (_, index) => (backIndexes.has(index) ? "back" : "front"));
}

function ensureBackFaceInRow(backIndexes: Set<number>, requiredRowIndexes: number[], oppositeRowIndexes: number[]) {
  if (requiredRowIndexes.some((index) => backIndexes.has(index))) {
    return;
  }

  const replacementIndex = requiredRowIndexes[Math.floor(Math.random() * requiredRowIndexes.length)];
  const removableIndex = oppositeRowIndexes.find((index) => backIndexes.has(index));

  if (replacementIndex === undefined || removableIndex === undefined) {
    return;
  }

  backIndexes.delete(removableIndex);
  backIndexes.add(replacementIndex);
}

function shuffleIndexes(count: number) {
  const indexes = Array.from({ length: count }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}

function createRandomBackTierSequence(count: number) {
  return Array.from({ length: count }, () => TIERS[Math.floor(Math.random() * TIERS.length)] ?? "A1");
}

function pickPreviewCard(language: LanguageCode, tier: Tier, term?: string) {
  const matchingCards = VOCABULARY_CARDS.filter((card) => card.language === language && card.tier === tier);

  if (term) {
    return (
      matchingCards.find((card) => card.term.toLocaleLowerCase("tr-TR") === term.toLocaleLowerCase("tr-TR")) ??
      matchingCards[0]
    );
  }

  return matchingCards[0];
}

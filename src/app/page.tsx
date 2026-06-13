import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Coins, Layers3, Search, Trophy } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_LABELS, TIER_STYLES } from "@/data/tiers";
import { VOCABULARY_CARDS } from "@/data/cards";
import { buttonClassName } from "@/components/ui/button";
import { LanguageFlag } from "@/components/language-flag";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { RANKS, TIER_POINTS } from "@/features/progress/progress-stats";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type HeroCardFace = "front" | "back";

const previewCards = [
  pickPreviewCard("en", "A1"),
  pickPreviewCard("en", "B1"),
  pickPreviewCard("de", "C1"),
].filter((card): card is VocabularyCard => Boolean(card));

const heroBackdropCards = [
  pickPreviewCard("en", "A1", "apple"),
  pickPreviewCard("de", "A1", "Wasser"),
  pickPreviewCard("ru", "A1"),
  pickPreviewCard("en", "B1", "decision"),
  pickPreviewCard("de", "B1"),
  pickPreviewCard("ru", "B1"),
  pickPreviewCard("en", "A2", "ticket"),
  pickPreviewCard("de", "A2"),
  pickPreviewCard("ru", "A2"),
  pickPreviewCard("en", "C1"),
  pickPreviewCard("de", "C1"),
  pickPreviewCard("ru", "C1"),
].filter((card): card is VocabularyCard => Boolean(card));

const HERO_BACKDROP_SEQUENCE_REPEATS = 2;

const featureItems = [
  {
    icon: Search,
    title: "Kelime keşfi",
    description: "Kelime arayarak veya 5-10 kart çekerek yeni kartları haznene eklersin.",
  },
  {
    icon: Layers3,
    title: "Dil envanteri",
    description: "İngilizce, Almanca ve Rusça kartların ayrı koleksiyonlarda düzenli kalır.",
  },
  {
    icon: Brain,
    title: "Quiz ile öğrenme",
    description: "Kartlar sadece doğru cevap sayısı tier eşiğine ulaşınca öğrenildi olur.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative isolate min-h-[76vh] overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-[0.74] brightness-125 contrast-125 saturate-125">
          <CardBackdrop />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_46%,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.58)_30%,rgba(15,23,42,0.26)_62%,rgba(2,6,23,0.22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.84)_30%,rgba(0,0,0,0.38)_58%,rgba(0,0,0,0.14)_100%)]" />

        <div className="relative mx-auto flex min-h-[76vh] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-6xl font-semibold leading-none md:text-7xl">Kartlarla Dil</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              Kelimeleri tek tek ezberlemek yerine koleksiyon kartlarına dönüştür. Kart çek, haznene ekle, quiz çöz
              ve tier eşiğini tamamladığında kartı gerçekten öğrenilmiş say.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/kart-cek" className={buttonClassName("primary", "lg", "bg-white text-slate-950 hover:bg-slate-200")}>
                Kart çekmeye başla
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/kartlarim" className={buttonClassName("secondary", "lg", "border-white/20 bg-white/10 text-white hover:bg-white/20")}>
                Envanteri gör
              </Link>
            </div>
            <div className="mt-5 flex items-center gap-3" aria-label="Desteklenen diller">
              {LANGUAGES.map((language) => (
                <LanguageFlag key={language.code} code={language.code} className="h-6 w-9 border-white/60" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          {featureItems.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section data-collection-preview-section className="bg-slate-50">
        <div className="mx-auto grid w-full max-w-[1500px] items-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(350px,0.75fr)_minmax(650px,1.25fr)] lg:gap-10 lg:px-8">
          <div>
            <h2 className="font-display text-4xl font-semibold text-slate-950">Kartlar fiziksel bir koleksiyon gibi çalışır.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Her kartın dili, seviyesi, telaffuzu, Türkçe karşılığı ve örnek cümlesi vardır. Kartlar haznene
              eklendikten sonra doğru cevap sayısı tier eşiğine göre takip edilir.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {LANGUAGES.map((language) => (
                <div key={language.code} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">{language.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{language.nativeName}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {TIERS.map((tier) => (
                <div key={tier} className="rounded-md border border-slate-200 bg-white p-3 text-center">
                  <p className="text-sm font-semibold text-slate-950">{tier}</p>
                  <p className="mt-1 text-xs text-slate-500">{TIER_LABELS[tier]}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-collection-preview-deck className="min-w-0 self-center overflow-x-auto lg:overflow-visible">
            <div className="grid w-full min-w-[360px] grid-cols-2 items-center gap-3 sm:min-w-[640px] sm:grid-cols-3 sm:gap-4 lg:min-w-[650px] lg:gap-5 xl:min-w-[760px]">
              {previewCards.map((card, index) => (
                <div
                  key={card.id}
                  data-collection-preview-card
                  className={index === 2 ? "hidden sm:block" : undefined}
                >
                  <VocabularyCardView card={card} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["1", "Kart seç", "Arama veya rastgele çekme ile haznene yeni kartlar ekle."],
              ["2", "Çeviriyi bil", "Öğren ekranında yabancı kelime gösterilir, Türkçe karşılığı sorulur."],
              ["3", "Eşiği tamamla", "Tier eşiğini dolduran kart otomatik öğrenildi olur."],
            ].map(([step, title, description]) => (
              <article key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                <div className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-sm font-bold text-white">
                  {step}
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-points-rank-section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:px-8">
          <div>
            <div className="flex size-12 items-center justify-center rounded-md bg-slate-950 text-white">
              <Coins className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-4xl font-semibold text-slate-950">Puan kazandıkça rank atla.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Bir kart yalnızca quiz eşiği tamamlanınca öğrenilmiş sayılır ve puan verir. Zor tier daha yüksek puan
              kazandırır; toplam puanın arttıkça navbar, profil menüsü ve profil sayfasındaki rankın otomatik yükselir.
            </p>
          </div>

          <div className="grid min-w-0 gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TIERS.map((tier) => (
                <div key={tier} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${TIER_STYLES[tier].text}`}>{tier}</span>
                    <span className={`size-2.5 rounded-full ${TIER_STYLES[tier].accent}`} aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{TIER_POINTS[tier]} puan</p>
                  <p className="mt-1 text-xs text-slate-500">{TIER_LABELS[tier]}</p>
                </div>
              ))}
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Rank yolu</p>
                  <p className="mt-1 text-xs text-slate-500">10 rank, 0 puandan 18.000 puana kadar ilerler.</p>
                </div>
                <p className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                  Öğrenilen kartlardan hesaplanır
                </p>
              </div>

              <div className="mt-5 min-w-0 overflow-x-auto">
                <div className="grid min-w-[760px] grid-cols-10 gap-3 lg:min-w-0">
                  {RANKS.map((rank) => (
                    <div key={rank.id} className="min-w-0 text-center">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                        <RankIcon icon={rank.icon} className={`size-5 ${getRankIconTone(rank.icon)}`} />
                      </div>
                      <p className="mt-2 truncate text-xs font-semibold text-slate-950" title={rank.label}>
                        {rank.label}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {rank.minPoints.toLocaleString("tr-TR")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Trophy className="size-6 text-amber-300" aria-hidden="true" />
              <h2 className="font-display text-3xl font-semibold">Koleksiyonunu büyüt.</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Giriş yapan kullanıcılar puan, rank ve kart ilerlemesini Supabase üzerinde kalıcı olarak takip eder.
            </p>
          </div>
          <Link href="/kart-cek" className={buttonClassName("primary", "lg", "bg-white text-slate-950 hover:bg-slate-200")}>
            Kart çek
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
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

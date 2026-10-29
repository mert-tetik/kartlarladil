import { renderToStaticMarkup } from "react-dom/server";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { fitCardExamples } from "@/features/cards/card-example-fitting";
import { getStudyLocale } from "@/features/cards/card-localization";
import { VocabularyCardDesign } from "@/features/cards/components/card-design-reference-preview";
import type { CardDesignTestSample } from "@/features/cards/card-design-test-sample";
import type { InventoryCard, LocaleCode, VocabularyCard } from "@/types/domain";

export interface OfflineCardRendererEntry {
  card: VocabularyCard;
  inventory: Pick<InventoryCard, "cardId" | "status" | "correctCount">;
}

export interface OfflineCardRendererLabels {
  active: string;
  learned: string;
}

declare global {
  interface Window {
    FoxiesDeckOfflineCardRenderer?: {
      render: (
        entries: OfflineCardRendererEntry[],
        locale: LocaleCode,
        labels: OfflineCardRendererLabels,
      ) => string;
      fitExamples: (root: ParentNode) => () => void;
    };
  }
}

function toDesignSample(card: VocabularyCard, nativeLanguage: LocaleCode, fallbackCardId: string): CardDesignTestSample {
  const studyLocale = getStudyLocale(card.language, nativeLanguage);
  const localizedMeanings = card.translationMeaningsByLocale?.[studyLocale] ?? [];
  const translation = localizedMeanings.slice(0, 3).join(", ")
    || card.translations?.[studyLocale]
    || card.translation
    || "";
  return {
    cardId: card.id || fallbackCardId,
    learningLanguage: card.language,
    nativeLanguage,
    tier: card.tier,
    term: card.term || card.translation || "",
    translation,
    partOfSpeech: card.partOfSpeech ?? "",
    pronunciation: card.pronunciation ?? "",
    example: card.examples?.[0]?.sentence ?? card.example ?? "",
  };
}

function OfflineSavedCards({
  entries,
  locale,
  labels,
}: {
  entries: OfflineCardRendererEntry[];
  locale: LocaleCode;
  labels: OfflineCardRendererLabels;
}) {
  return entries.map(({ card, inventory }) => {
    const isLearned = inventory.status === "learned";
    const requirement = TIER_REQUIREMENTS[card.tier];
    const progress = isLearned
      ? requirement
      : Math.min(requirement, Math.max(0, Number(inventory.correctCount) || 0));

    return (
      <article
        className="offline-card-item"
        data-card-id={inventory.cardId || card.id}
        data-card-language={card.language}
        data-saved-card-status={isLearned ? "learned" : "active"}
        data-saved-card-tier={card.tier}
        key={inventory.cardId || card.id}
      >
        <VocabularyCardDesign
          className="offline-card-design"
          learningProgress={{
            current: progress,
            required: requirement,
            progressLabel: labels.active,
            isLearned,
          }}
          sample={toDesignSample(card, locale, inventory.cardId)}
          showGroupImage={false}
        />
      </article>
    );
  });
}

if (typeof window !== "undefined") {
  window.FoxiesDeckOfflineCardRenderer = {
    render: (entries, locale, labels) =>
      renderToStaticMarkup(<OfflineSavedCards entries={entries} locale={locale} labels={labels} />),
    fitExamples: (root) => {
      fitCardExamples(root);
      const cards = Array.from(root.querySelectorAll<HTMLElement>(".fd-card-design"));

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => fitCardExamples(root));
        cards.forEach((card) => observer.observe(card));
        return () => observer.disconnect();
      }

      const fit = () => fitCardExamples(root);
      window.addEventListener("resize", fit);
      return () => window.removeEventListener("resize", fit);
    },
  };
}

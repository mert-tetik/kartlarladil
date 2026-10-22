import { renderToStaticMarkup } from "react-dom/server";
import { TIER_REQUIREMENTS } from "@/data/tiers";
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
    const percentage = Math.round((progress / requirement) * 100);

    return (
      <article
        className="offline-card-item"
        data-card-id={inventory.cardId || card.id}
        data-card-language={card.language}
        data-saved-card-status={isLearned ? "learned" : "active"}
        data-saved-card-tier={card.tier}
        key={inventory.cardId || card.id}
      >
        <VocabularyCardDesign className="offline-card-design" sample={toDesignSample(card, locale, inventory.cardId)} />
        <div className="offline-card-progress" data-offline-card-progress>
          <div className="offline-card-progress__label">
            <span>{isLearned ? labels.learned : labels.active}</span>
            <span>{progress}/{requirement}</span>
          </div>
          <div className="offline-card-progress__track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={requirement}>
            <span className="offline-card-progress__fill" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </article>
    );
  });
}

if (typeof window !== "undefined") {
  window.FoxiesDeckOfflineCardRenderer = {
    render: (entries, locale, labels) =>
      renderToStaticMarkup(<OfflineSavedCards entries={entries} locale={locale} labels={labels} />),
  };
}

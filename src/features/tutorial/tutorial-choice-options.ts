import type { TranslationKey } from "@/i18n/dictionaries";

export const TUTORIAL_CHOICES = [
  {
    key: "random",
    selector: '[data-tutorial-target="landing-draw-cards"]',
    layer: "draw-cards",
    icon: "/card-icons/draw_cards_button.png",
    titleKey: "tutorial.cardModes.random.title",
    descriptionKey: "tutorial.cardModes.random.description",
    continuationTitleKey: "quiz.continuation.addRandomCards",
  },
  {
    key: "custom",
    selector: '[data-tutorial-target="landing-create-card"]',
    layer: "custom-card",
    icon: "/card-icons/add_custom_card_button.png",
    titleKey: "tutorial.cardModes.custom.title",
    descriptionKey: "tutorial.cardModes.custom.description",
    continuationTitleKey: "quiz.continuation.searchWords",
  },
  {
    key: "groups",
    selector: '[data-tutorial-target="landing-card-groups"]',
    layer: "card-groups",
    icon: "/card-icons/add_cards_with_groups.png",
    titleKey: "tutorial.cardModes.groups.title",
    descriptionKey: "tutorial.cardModes.groups.description",
    continuationTitleKey: "quiz.continuation.addFromCollections",
  },
] as const satisfies readonly {
  key: "random" | "custom" | "groups";
  selector: string;
  layer: string;
  icon: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  continuationTitleKey: TranslationKey;
}[];

export const CUSTOM_CARD_DEFAULT_MODEL = "gpt-5.6-luna";
export const CUSTOM_CARD_REASONING_EFFORT = "none" as const;

/**
 * Custom-card generation has its own model override so changing it does not
 * silently change AI Practice, Ask, or quiz validation traffic.
 */
export function getCustomCardModel() {
  return process.env.OPENAI_CUSTOM_CARD_MODEL?.trim() || CUSTOM_CARD_DEFAULT_MODEL;
}

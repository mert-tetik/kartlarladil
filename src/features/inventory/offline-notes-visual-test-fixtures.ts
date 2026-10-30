import type { LocaleCode } from "@/types/domain";
import type { OfflineSavedNoteEntry } from "@/features/inventory/offline-card-storage";

export const OFFLINE_NOTES_VISUAL_TEST_PROFILE_ID = "offline-notes-visual-test";

/*
 * The visual test exercises the exact same conversion overlay, authenticated
 * custom-card API, local optimistic inventory update, and landing render path
 * as production. Its only intentional difference is replacing saved-note
 * storage with random sample notes.
 */
const VISUAL_TEST_NOTE_POOL = [
  { id: "visual-note-serendipity", text: "serendipity", targetLanguage: "en" },
  { id: "visual-note-ephemeral", text: "ephemeral", targetLanguage: "en" },
  { id: "visual-note-daydream", text: "daydream", targetLanguage: "en" },
  { id: "visual-note-sobremesa", text: "sobremesa", targetLanguage: "es" },
  { id: "visual-note-madrugada", text: "madrugada", targetLanguage: "es" },
  { id: "visual-note-wanderlust", text: "Wanderlust", targetLanguage: "de" },
  { id: "visual-note-fernweh", text: "Fernweh", targetLanguage: "de" },
  { id: "visual-note-depaysement", text: "dépaysement", targetLanguage: "fr" },
  { id: "visual-note-ephemere", text: "éphémère", targetLanguage: "fr" },
  { id: "visual-note-magari", text: "magari", targetLanguage: "it" },
  { id: "visual-note-passeggiata", text: "passeggiata", targetLanguage: "it" },
  { id: "visual-note-saudade", text: "saudade", targetLanguage: "pt" },
  { id: "visual-note-cafune", text: "cafuné", targetLanguage: "pt" },
  { id: "visual-note-gezellig", text: "gezellig", targetLanguage: "nl" },
  { id: "visual-note-uitwaaien", text: "uitwaaien", targetLanguage: "nl" },
  { id: "visual-note-tesknota", text: "tęsknota", targetLanguage: "pl" },
  { id: "visual-note-przedwiosnie", text: "przedwiośnie", targetLanguage: "pl" },
  { id: "visual-note-toska", text: "тоска", targetLanguage: "ru" },
  { id: "visual-note-uyut", text: "уют", targetLanguage: "ru" },
  { id: "visual-note-komorebi", text: "木漏れ日", targetLanguage: "ja" },
  { id: "visual-note-wabisabi", text: "わびさび", targetLanguage: "ja" },
] as const;

function shuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function createOfflineNotesVisualTestNotes(locale: LocaleCode): OfflineSavedNoteEntry[] {
  return shuffle(VISUAL_TEST_NOTE_POOL)
    .slice(0, 10)
    .map((note) => ({
      profileId: OFFLINE_NOTES_VISUAL_TEST_PROFILE_ID,
      note: { ...note, nativeLocale: locale },
    }));
}

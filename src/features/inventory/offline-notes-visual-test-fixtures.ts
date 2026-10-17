import type { LocaleCode } from "@/types/domain";
import type { OfflineSavedNoteEntry } from "@/features/inventory/offline-card-storage";

export const OFFLINE_NOTES_VISUAL_TEST_PROFILE_ID = "offline-notes-visual-test";

const VISUAL_TEST_NOTES = [
  { id: "visual-note-serendipity", text: "serendipity", targetLanguage: "en" },
  { id: "visual-note-sobremesa", text: "sobremesa", targetLanguage: "es" },
  { id: "visual-note-wanderlust", text: "Wanderlust", targetLanguage: "de" },
  { id: "visual-note-depaysement", text: "dépaysement", targetLanguage: "fr" },
  { id: "visual-note-magari", text: "magari", targetLanguage: "it" },
  { id: "visual-note-saudade", text: "saudade", targetLanguage: "pt" },
  { id: "visual-note-gezellig", text: "gezellig", targetLanguage: "nl" },
  { id: "visual-note-tesknota", text: "tęsknota", targetLanguage: "pl" },
  { id: "visual-note-toska", text: "тоска", targetLanguage: "ru" },
  { id: "visual-note-komorebi", text: "木漏れ日", targetLanguage: "ja" },
] as const;

export function createOfflineNotesVisualTestNotes(locale: LocaleCode): OfflineSavedNoteEntry[] {
  return VISUAL_TEST_NOTES.map((note) => ({
    profileId: OFFLINE_NOTES_VISUAL_TEST_PROFILE_ID,
    note: { ...note, nativeLocale: locale },
  }));
}

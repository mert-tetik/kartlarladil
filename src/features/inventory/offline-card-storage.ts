import type { LanguageCode, LocaleCode } from "@/types/domain";
import type { OfflineInventoryEntry } from "@/features/inventory/offline-inventory-snapshot";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";

const DATABASE_NAME = "foxiesdeck-offline-v1";
const DATABASE_VERSION = 1;
const PROFILE_STORAGE_KEY = "foxiesdeck:offline-profile";
const LOCALE_STORAGE_KEY = "foxiesdeck:locale";
const CARD_LANGUAGE_STORAGE_KEY = "foxiesdeck:landing-card-language";

interface OfflineSnapshotProfile {
  id: string;
  nativeLanguage: LocaleCode;
  cardLanguage: LanguageCode;
  /** Backward-compatible aliases read by older installed offline shells. */
  locale: LocaleCode;
  learningLanguage: LanguageCode;
  updatedAt: string;
}

export interface OfflineSavedNote {
  id: string;
  text: string;
  targetLanguage: LanguageCode;
  nativeLocale: LocaleCode;
  createdAt?: string;
}

export interface OfflineSavedNoteEntry {
  profileId: string;
  note: OfflineSavedNote;
}

export interface OfflineGeneratedCardDraft {
  id: string;
  noteId: string;
  sourceProfileId: string;
  storageProfileId: string;
  targetLanguage: LanguageCode;
  generated: GeneratedCardResponse;
  createdAt: string;
  /** The card was optimistically added and is waiting for cloud confirmation. */
  pendingAdd?: boolean;
}

export interface OfflineGeneratedCardDraftEntry {
  profileId: string;
  draft: OfflineGeneratedCardDraft;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("profiles")) {
        const profiles = database.createObjectStore("profiles", { keyPath: "id" });
        profiles.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains("cards")) {
        const cards = database.createObjectStore("cards", { keyPath: "key" });
        cards.createIndex("profileId", "profileId");
      }
      if (!database.objectStoreNames.contains("notes")) {
        const notes = database.createObjectStore("notes", { keyPath: "key" });
        notes.createIndex("profileId", "profileId");
      }
      if (!database.objectStoreNames.contains("drafts")) {
        const drafts = database.createObjectStore("drafts", { keyPath: "key" });
        drafts.createIndex("profileId", "profileId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("offline_database_open_failed"));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("offline_database_transaction_failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("offline_database_transaction_aborted"));
  });
}

function snapshotFallbackKey(profileId: string) {
  return `${DATABASE_NAME}:snapshot:${profileId}`;
}

function fallbackRecordsKey(storeName: "notes", profileId: string) {
  return `${DATABASE_NAME}:fallback:${storeName}:${profileId}`;
}

function readFallbackNoteEntries(profileId: string): OfflineSavedNoteEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(fallbackRecordsKey("notes", profileId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((record): OfflineSavedNoteEntry[] => {
      if (!record || typeof record !== "object") return [];
      const candidate = record as { profileId?: unknown; note?: unknown };
      if (!candidate.note || typeof candidate.note !== "object") return [];
      const note = candidate.note as Partial<OfflineSavedNote>;
      if (typeof note.id !== "string" || typeof note.text !== "string") return [];

      return [{ profileId: typeof candidate.profileId === "string" ? candidate.profileId : profileId, note: note as OfflineSavedNote }];
    });
  } catch {
    return [];
  }
}

async function readOfflineProfileEntries<T>(storeName: "notes" | "drafts", profileId: string): Promise<T[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index("profileId").getAll(profileId);
    const records = await new Promise<T[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as T[] | undefined) ?? []);
      request.onerror = () => reject(request.error ?? new Error("offline_storage_request_failed"));
    });
    await waitForTransaction(transaction);
    return records;
  } finally {
    database.close();
  }
}

export async function listOfflineSavedNotes(profileId: string): Promise<OfflineSavedNoteEntry[]> {
  let indexedDbEntries: Array<{ profileId?: string; note?: OfflineSavedNote }> = [];
  try {
    indexedDbEntries = await readOfflineProfileEntries("notes", profileId);
  } catch {
    // A localStorage fallback is maintained by the offline shell when IndexedDB is unavailable.
  }

  const byId = new Map<string, OfflineSavedNoteEntry>();
  for (const entry of [...indexedDbEntries, ...readFallbackNoteEntries(profileId)]) {
    if (entry.note?.id && !byId.has(entry.note.id)) {
      byId.set(entry.note.id, { profileId: entry.profileId ?? profileId, note: entry.note });
    }
  }
  return [...byId.values()];
}

export async function listOfflineGeneratedDrafts(profileId: string): Promise<OfflineGeneratedCardDraftEntry[]> {
  const entries = await readOfflineProfileEntries<{ profileId?: string; draft?: OfflineGeneratedCardDraft }>("drafts", profileId);
  return entries.flatMap((entry) => entry.draft?.id
    ? [{ profileId: entry.profileId ?? profileId, draft: entry.draft }]
    : []);
}

export async function removeOfflineSavedNote(profileId: string, noteId: string): Promise<void> {
  const fallbackKey = fallbackRecordsKey("notes", profileId);
  let fallbackCleared = true;
  try {
    const fallbackEntries = readFallbackNoteEntries(profileId);
    if (fallbackEntries.some((entry) => entry.note.id === noteId)) {
      localStorage.setItem(fallbackKey, JSON.stringify(fallbackEntries
        .filter((entry) => entry.note.id !== noteId)
        .map((entry) => ({ key: `${entry.profileId}:${entry.note.id}`, profileId: entry.profileId, note: entry.note, createdAt: entry.note.createdAt }))));
    }
  } catch {
    fallbackCleared = false;
  }

  let indexedDbDeleted = false;
  let indexedDbError: unknown;
  try {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("notes", "readwrite");
      transaction.objectStore("notes").delete(`${profileId}:${noteId}`);
      await waitForTransaction(transaction);
      indexedDbDeleted = true;
    } finally {
      database.close();
    }
  } catch (error) {
    indexedDbError = error;
  }

  if (!fallbackCleared || !indexedDbDeleted) {
    throw indexedDbError ?? new Error("offline_note_delete_failed");
  }
}

export async function saveOfflineGeneratedDraft(profileId: string, draft: OfflineGeneratedCardDraft): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").put({
      key: `${profileId}:${draft.id}`,
      profileId,
      draft,
      createdAt: draft.createdAt,
    });
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function removeOfflineGeneratedDraft(profileId: string, draftId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").delete(`${profileId}:${draftId}`);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

function setActiveProfile(profileId: string, nativeLanguage: LocaleCode, cardLanguage: LanguageCode) {
  localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
  localStorage.setItem(LOCALE_STORAGE_KEY, nativeLanguage);
  localStorage.setItem(CARD_LANGUAGE_STORAGE_KEY, cardLanguage);
}

export async function saveOfflineInventorySnapshot(input: {
  profileId: string;
  nativeLanguage: LocaleCode;
  cardLanguage: LanguageCode;
  cards: OfflineInventoryEntry[];
  complete: boolean;
}): Promise<{ ok: boolean; storage?: "indexeddb" | "localstorage" }> {
  const updatedAt = new Date().toISOString();
  const profile: OfflineSnapshotProfile = {
    id: input.profileId,
    nativeLanguage: input.nativeLanguage,
    cardLanguage: input.cardLanguage,
    locale: input.nativeLanguage,
    learningLanguage: input.cardLanguage,
    updatedAt,
  };
  const records = input.cards.map((entry) => ({
    key: `${input.profileId}:${entry.inventory.cardId}`,
    profileId: input.profileId,
    inventory: entry.inventory,
    card: entry.card,
    updatedAt,
  }));

  try {
    setActiveProfile(input.profileId, input.nativeLanguage, input.cardLanguage);
  } catch (error) {
    console.error("[FoxiesDeck offline] Could not persist active profile/language preferences.", error);
  }

  try {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(["profiles", "cards"], "readwrite");
      transaction.objectStore("profiles").put(profile);
      const cardStore = transaction.objectStore("cards");
      records.forEach((record) => cardStore.put(record));

      if (input.complete) {
        const knownKeys = new Set(records.map((record) => record.key));
        const existingRequest = cardStore.index("profileId").getAll(input.profileId);
        existingRequest.onsuccess = () => {
          for (const existing of existingRequest.result as Array<{ key: string }>) {
            if (!knownKeys.has(existing.key)) cardStore.delete(existing.key);
          }
        };
      }

      await waitForTransaction(transaction);
    } finally {
      database.close();
    }

    try {
      localStorage.removeItem(snapshotFallbackKey(input.profileId));
    } catch {
      // The IndexedDB copy is already committed; a stale fallback can be ignored by timestamp.
    }
    if (navigator.storage?.persist && !window.__foxiesDeckOfflinePersistenceRequested) {
      window.__foxiesDeckOfflinePersistenceRequested = true;
      void navigator.storage.persist().catch(() => false);
    }
    return { ok: true, storage: "indexeddb" };
  } catch (indexedDbError) {
    try {
      localStorage.setItem(snapshotFallbackKey(input.profileId), JSON.stringify({ profile, cards: records }));
      console.warn("[FoxiesDeck offline] IndexedDB save failed; saved a localStorage fallback.", indexedDbError);
      return { ok: true, storage: "localstorage" };
    } catch (fallbackError) {
      console.error("[FoxiesDeck offline] Could not save the inventory snapshot.", { indexedDbError, fallbackError });
      return { ok: false };
    }
  }
}

declare global {
  interface Window {
    __foxiesDeckOfflinePersistenceRequested?: boolean;
  }
}

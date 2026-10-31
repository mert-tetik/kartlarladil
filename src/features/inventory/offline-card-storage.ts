import type { LanguageCode, LocaleCode } from "@/types/domain";
import type { OfflineInventoryEntry } from "@/features/inventory/offline-inventory-snapshot";
import { generatedCardSchema, type GeneratedCardResponse } from "@/features/cards/create-card-schema";

const DATABASE_NAME = "foxiesdeck-offline-v1";
const DATABASE_VERSION = 1;
const DATABASE_OPEN_TIMEOUT_MS = 1_500;
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
    let settled = false;
    let timeout = 0;
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(error);
    };
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      rejectOnce(error);
      return;
    }
    timeout = window.setTimeout(() => {
      rejectOnce(new Error("offline_database_open_timeout"));
    }, DATABASE_OPEN_TIMEOUT_MS);
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
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => rejectOnce(request.error ?? new Error("offline_database_open_failed"));
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

function fallbackRecordsKey(storeName: "notes" | "drafts", profileId: string) {
  return `${DATABASE_NAME}:fallback:${storeName}:${profileId}`;
}

function dismissedRecordsKey(storeName: "notes" | "drafts", profileId: string) {
  return `${DATABASE_NAME}:dismissed:${storeName}:${profileId}`;
}

function readDismissedRecordIds(storeName: "notes" | "drafts", profileId: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(dismissedRecordsKey(storeName, profileId)) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function markRecordDismissed(storeName: "notes" | "drafts", profileId: string, recordId: string) {
  try {
    const dismissed = readDismissedRecordIds(storeName, profileId);
    dismissed.add(recordId);
    localStorage.setItem(dismissedRecordsKey(storeName, profileId), JSON.stringify([...dismissed]));
    return true;
  } catch {
    return false;
  }
}

function clearDismissedRecordIds(storeName: "notes" | "drafts", profileId: string, recordIds: ReadonlySet<string>) {
  try {
    const dismissed = readDismissedRecordIds(storeName, profileId);
    for (const id of recordIds) dismissed.delete(id);
    const key = dismissedRecordsKey(storeName, profileId);
    if (dismissed.size === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify([...dismissed]));
    return true;
  } catch {
    return false;
  }
}

function clearFallbackRecords(storeName: "notes" | "drafts", profileId: string, recordIds: ReadonlySet<string>) {
  try {
    const key = fallbackRecordsKey(storeName, profileId);
    if (storeName === "notes") {
      const remaining = readFallbackNoteEntries(profileId).filter((entry) => !recordIds.has(entry.note.id));
      localStorage.setItem(key, JSON.stringify(remaining.map((entry) => ({
        key: `${entry.profileId}:${entry.note.id}`,
        profileId: entry.profileId,
        note: entry.note,
        createdAt: entry.note.createdAt,
      }))));
    } else {
      const remaining = readFallbackDraftEntries(profileId).filter((entry) => !recordIds.has(entry.draft.id));
      localStorage.setItem(key, JSON.stringify(remaining.map((entry) => ({
        key: `${entry.profileId}:${entry.draft.id}`,
        profileId: entry.profileId,
        draft: entry.draft,
        createdAt: entry.draft.createdAt,
      }))));
    }
    return true;
  } catch {
    return false;
  }
}

async function reapDismissedRecords(storeName: "notes" | "drafts", profileId: string, recordIds: ReadonlySet<string>) {
  if (recordIds.size === 0 || !clearFallbackRecords(storeName, profileId, recordIds)) return;
  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    const completed = waitForTransaction(transaction);
    for (const recordId of recordIds) transaction.objectStore(storeName).delete(`${profileId}:${recordId}`);
    await completed;
    clearDismissedRecordIds(storeName, profileId, recordIds);
  } catch {
    // Tombstones remain in localStorage until both copies can be reaped safely.
  } finally {
    database?.close();
  }
}

function readFallbackDraftEntries(profileId: string): OfflineGeneratedCardDraftEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(fallbackRecordsKey("drafts", profileId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((record): OfflineGeneratedCardDraftEntry[] => {
      if (!record || typeof record !== "object") return [];
      const candidate = record as { profileId?: unknown; draft?: unknown };
      if (candidate.profileId !== undefined && candidate.profileId !== profileId) return [];
      const draft = parseOfflineGeneratedCardDraft(candidate.draft, profileId);
      return draft ? [{ profileId, draft }] : [];
    });
  } catch {
    return [];
  }
}

function parseOfflineGeneratedCardDraft(
  value: unknown,
  profileId: string,
): OfflineGeneratedCardDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<OfflineGeneratedCardDraft>;
  if (
    typeof draft.id !== "string" || !/^[a-zA-Z0-9._-]{8,100}$/.test(draft.id) ||
    typeof draft.noteId !== "string" || draft.noteId.length === 0 || draft.noteId.length > 128 ||
    typeof draft.sourceProfileId !== "string" || draft.sourceProfileId.length === 0 || draft.sourceProfileId.length > 128 ||
    draft.storageProfileId !== profileId ||
    typeof draft.createdAt !== "string" || draft.createdAt.length === 0 || draft.createdAt.length > 64 ||
    (draft.pendingAdd !== undefined && typeof draft.pendingAdd !== "boolean")
  ) {
    return null;
  }

  const generated = generatedCardSchema.safeParse(draft.generated);
  if (!generated.success || draft.targetLanguage !== generated.data.language) return null;

  return {
    id: draft.id,
    noteId: draft.noteId,
    sourceProfileId: draft.sourceProfileId,
    storageProfileId: profileId,
    targetLanguage: generated.data.language,
    generated: generated.data,
    createdAt: draft.createdAt,
    pendingAdd: draft.pendingAdd === true,
  };
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

async function readOfflineProfileEntries<T>(storeName: "cards" | "notes" | "drafts", profileId: string): Promise<T[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    const completed = waitForTransaction(transaction);
    const request = transaction.objectStore(storeName).index("profileId").getAll(profileId);
    const records = await new Promise<T[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as T[] | undefined) ?? []);
      request.onerror = () => reject(request.error ?? new Error("offline_storage_request_failed"));
    });
    await completed;
    return records;
  } finally {
    database.close();
  }
}

function readFallbackInventoryEntries(profileId: string): OfflineInventoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(snapshotFallbackKey(profileId)) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const records = (parsed as { cards?: unknown }).cards;
    if (!Array.isArray(records)) return [];

    return records.flatMap((record): OfflineInventoryEntry[] => {
      if (!record || typeof record !== "object") return [];
      const candidate = record as { profileId?: unknown; inventory?: unknown; card?: unknown };
      if (candidate.profileId !== undefined && candidate.profileId !== profileId) return [];
      if (!candidate.inventory || typeof candidate.inventory !== "object") return [];
      if (!candidate.card || typeof candidate.card !== "object") return [];
      return [{
        inventory: candidate.inventory as OfflineInventoryEntry["inventory"],
        card: candidate.card as OfflineInventoryEntry["card"],
      }];
    });
  } catch {
    return [];
  }
}

export async function listOfflineInventorySnapshot(profileId: string): Promise<OfflineInventoryEntry[] | null> {
  let indexedDbEntries: Array<{ profileId?: string; inventory?: unknown; card?: unknown }> = [];
  let indexedDbReadSucceeded = false;
  try {
    indexedDbEntries = await readOfflineProfileEntries("cards", profileId);
    indexedDbReadSucceeded = true;
  } catch {
    // The localStorage snapshot is used when IndexedDB is unavailable.
  }

  const entries: Array<{ profileId?: unknown; inventory?: unknown; card?: unknown }> = [
    ...indexedDbEntries,
    ...readFallbackInventoryEntries(profileId),
  ];
  const byCardId = new Map<string, OfflineInventoryEntry>();
  for (const entry of entries) {
    if (entry.profileId !== undefined && entry.profileId !== profileId) continue;
    if (!entry.inventory || typeof entry.inventory !== "object") continue;
    if (!entry.card || typeof entry.card !== "object") continue;
    const inventory = entry.inventory as OfflineInventoryEntry["inventory"];
    const card = entry.card as OfflineInventoryEntry["card"];
    const cardId = inventory.cardId;
    if (typeof cardId !== "string" || byCardId.has(cardId)) continue;
    byCardId.set(cardId, { inventory, card });
  }

  // null distinguishes “no snapshot exists yet” from a valid empty snapshot.
  if (indexedDbReadSucceeded || entries.length > 0) return [...byCardId.values()];
  return null;
}

export async function listOfflineSavedNotes(profileId: string): Promise<OfflineSavedNoteEntry[]> {
  let indexedDbEntries: Array<{ profileId?: string; note?: OfflineSavedNote }> = [];
  let indexedDbReadSucceeded = false;
  try {
    indexedDbEntries = await readOfflineProfileEntries("notes", profileId);
    indexedDbReadSucceeded = true;
  } catch {
    // A localStorage fallback is maintained by the offline shell when IndexedDB is unavailable.
  }

  const dismissedIds = readDismissedRecordIds("notes", profileId);
  if (indexedDbReadSucceeded && dismissedIds.size > 0) {
    void reapDismissedRecords("notes", profileId, dismissedIds);
  }
  const byId = new Map<string, OfflineSavedNoteEntry>();
  for (const entry of [...indexedDbEntries, ...readFallbackNoteEntries(profileId)]) {
    if (entry.note?.id && !dismissedIds.has(entry.note.id) && !byId.has(entry.note.id)) {
      byId.set(entry.note.id, { profileId: entry.profileId ?? profileId, note: entry.note });
    }
  }
  return [...byId.values()];
}

export async function listOfflineGeneratedDrafts(profileId: string): Promise<OfflineGeneratedCardDraftEntry[]> {
  let indexedDbEntries: unknown[] = [];
  let indexedDbReadSucceeded = false;
  try {
    indexedDbEntries = await readOfflineProfileEntries("drafts", profileId);
    indexedDbReadSucceeded = true;
  } catch {
    // A localStorage fallback is used when IndexedDB is unavailable.
  }
  const dismissedIds = readDismissedRecordIds("drafts", profileId);
  if (indexedDbReadSucceeded && dismissedIds.size > 0) {
    void reapDismissedRecords("drafts", profileId, dismissedIds);
  }
  const byId = new Map<string, OfflineGeneratedCardDraftEntry>();
  for (const value of [...indexedDbEntries, ...readFallbackDraftEntries(profileId)]) {
    if (!value || typeof value !== "object") continue;
    const entry = value as { profileId?: unknown; draft?: unknown };
    if (entry.profileId !== profileId) continue;
    const draft = parseOfflineGeneratedCardDraft(entry.draft, profileId);
    if (draft && !dismissedIds.has(draft.id) && !byId.has(draft.id)) {
      byId.set(draft.id, { profileId, draft });
    }
  }
  return [...byId.values()];
}

export async function removeOfflineSavedNote(profileId: string, noteId: string): Promise<void> {
  const dismissedIds = new Set([noteId]);
  const tombstoneStored = markRecordDismissed("notes", profileId, noteId);
  const fallbackCleared = clearFallbackRecords("notes", profileId, dismissedIds);

  let indexedDbDeleted = false;
  let indexedDbError: unknown;
  try {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("notes", "readwrite");
      const completed = waitForTransaction(transaction);
      transaction.objectStore("notes").delete(`${profileId}:${noteId}`);
      await completed;
      indexedDbDeleted = true;
    } finally {
      database.close();
    }
  } catch (error) {
    indexedDbError = error;
  }

  if (indexedDbDeleted && fallbackCleared) {
    clearDismissedRecordIds("notes", profileId, dismissedIds);
  }
  if (!tombstoneStored && (!fallbackCleared || !indexedDbDeleted)) {
    throw indexedDbError ?? new Error("offline_note_delete_failed");
  }
}

export async function saveOfflineGeneratedDraft(profileId: string, draft: OfflineGeneratedCardDraft): Promise<void> {
  const validatedDraft = parseOfflineGeneratedCardDraft(draft, profileId);
  if (!validatedDraft) throw new Error("offline_generated_card_draft_invalid");
  clearDismissedRecordIds("drafts", profileId, new Set([validatedDraft.id]));
  const record = {
    key: `${profileId}:${validatedDraft.id}`,
    profileId,
    draft: validatedDraft,
    createdAt: validatedDraft.createdAt,
  };
  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase();
    const transaction = database.transaction("drafts", "readwrite");
    const completed = waitForTransaction(transaction);
    transaction.objectStore("drafts").put(record);
    await completed;
    try {
      localStorage.setItem(fallbackRecordsKey("drafts", profileId), JSON.stringify(
        readFallbackDraftEntries(profileId).filter((entry) => entry.draft.id !== validatedDraft.id),
      ));
    } catch {
      // IndexedDB is already committed; a stale fallback is harmless.
    }
  } catch (indexedDbError) {
    try {
      const existing = readFallbackDraftEntries(profileId).filter((entry) => entry.draft.id !== validatedDraft.id);
      localStorage.setItem(fallbackRecordsKey("drafts", profileId), JSON.stringify([...existing, record]));
    } catch (fallbackError) {
      throw fallbackError instanceof Error ? fallbackError : indexedDbError;
    }
  } finally {
    database?.close();
  }
}

export async function removeOfflineGeneratedDraft(profileId: string, draftId: string): Promise<void> {
  const dismissedIds = new Set([draftId]);
  const tombstoneStored = markRecordDismissed("drafts", profileId, draftId);
  const fallbackCleared = clearFallbackRecords("drafts", profileId, dismissedIds);

  let indexedDbDeleted = false;
  let indexedDbError: unknown;
  try {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("drafts", "readwrite");
      const completed = waitForTransaction(transaction);
      transaction.objectStore("drafts").delete(`${profileId}:${draftId}`);
      await completed;
      indexedDbDeleted = true;
    } finally {
      database.close();
    }
  } catch (error) {
    indexedDbError = error;
  }

  if (indexedDbDeleted && fallbackCleared) {
    clearDismissedRecordIds("drafts", profileId, dismissedIds);
  }
  if (!tombstoneStored && (!fallbackCleared || !indexedDbDeleted)) {
    throw indexedDbError ?? new Error("offline_draft_delete_failed");
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
      const completed = waitForTransaction(transaction);
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

      await completed;
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

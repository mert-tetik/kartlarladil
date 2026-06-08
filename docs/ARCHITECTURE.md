# Kartlarla Dil Architecture

Kartlarla Dil is split around product domains instead of technical buckets. `cards`, `inventory`, `quiz`, and `auth` each own their behavior and expose small interfaces to the pages.

## Domain model

- `VocabularyCard` is immutable catalog data.
- `VocabularyCard.sourceKey` is the stable Supabase import key; local `id` matches it until the catalog is imported and mapped to Supabase UUIDs.
- `CardExample` stores one target-language example, Turkish translation, and usage context label.
- `GrammarGuide` stores short grammar notes plus optional conjugation/usage tables.
- `InventoryCard` is user-owned progress data.
- `PracticeAttempt` is an audit record for quiz answers.
- `Tier` controls the number of correct answers needed before a card becomes learned.

The learning rule lives in `src/features/quiz/quiz-engine.ts`. UI code should not duplicate the threshold or status transition logic. Card details are study material, so quiz screens must hide them before the user answers and may reveal them only in the feedback state.

## Data flow

1. `localCardRepository` reads the generated starter catalog from `src/data/cards.ts`.
2. Guest inventory persists to `localStorage` under `kartlarla-dil:v2`.
3. Authenticated inventory uses Supabase `user_cards` and `practice_attempts`; client state is hydrated from cloud server actions.
4. Cloud inventory maps local `VocabularyCard.sourceKey` values to Supabase `cards.id` UUID values through `cards.source_key`.

## Auth flow

`src/lib/supabase` owns browser, server, admin, and proxy clients. `src/features/auth/actions.ts` owns all mutations:
login, register, password reset, password update, profile update, logout, and permanent account deletion.

The root `proxy.ts` refreshes Supabase cookies before Server Components read auth state. UI components receive only serializable
user fields: id, email, display name, and preferred language. Service role access is isolated to the server-only admin client.

Client write actions use the auth session provider before mutating inventory state. Guests can still search, draw cards,
and inspect card details, but adding cards, recording quiz answers, and resetting inventory redirect to `/register?next=...`.
Authenticated users write through Supabase-backed inventory actions.

Discover filters are remembered in `localStorage` under `kartlarla-dil:discover-filters:v1`. The initial filter falls back to
the authenticated profile preference, then to English A1.

Progress stats are derived from inventory, not stored as mutable counters. Learned cards produce tier-based points:
A1 = 10, A2 = 20, B1 = 40, B2 = 70, C1 = 110. Rank is calculated from total points and shared by the navbar,
account menu, and `/profil` page.

## UI structure

- `src/app` contains route shells only.
- `src/components` contains shared UI and layout.
- `src/features/*/components` contains feature-specific UI.
- `src/features/*/*.ts` contains domain behavior.

Keep card visuals in `VocabularyCardView` so inventory, discovery, and previews stay consistent. `CardDetailsDialog` owns the expanded examples and grammar view so every card surface renders the same study material.

## Starter catalog

The starter catalog is quality-first and single-word-only. `VocabularyCard.term` must contain one lexical item, not a phrase, sentence pattern, or generated usage context. Expressions belong in examples or future phrase-specific fields, not in the main card term.

The local catalog is built from curated seed words for English, German, and Russian. IDs and `sourceKey` values are deterministic from language, tier, term, and part of speech so Supabase imports can upsert consistently without relying on array indexes.

Every card keeps `example` and `exampleTranslation` as backward-compatible first-example fields. The full detail data lives in `examples` and `grammar`; future Supabase imports should preserve that shape and upsert cards by `sourceKey`. Use `npm run report:cards` to inspect the current catalog count and validation report.

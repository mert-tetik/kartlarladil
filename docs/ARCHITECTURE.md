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
2. `useInventoryStore` persists user-owned cards and attempts to `localStorage` under `kartlarla-dil:v2`.
3. Route-level client components read from the store and render filtered views.
4. Future Supabase repositories should map `cards.source_key` to local catalog records and use Supabase `cards.id` UUID values for `user_cards.card_id`.

## Auth flow

`src/lib/supabase` owns browser, server, admin, and proxy clients. `src/features/auth/actions.ts` owns all mutations:
login, register, password reset, password update, profile update, logout, and permanent account deletion.

The root `proxy.ts` refreshes Supabase cookies before Server Components read auth state. UI components receive only serializable
user fields: id, email, display name, and preferred language. Service role access is isolated to the server-only admin client.

Client write actions use the auth session provider before mutating local inventory state. Guests can still search, draw cards,
and inspect card details, but adding cards, recording quiz answers, and resetting inventory redirect to `/register?next=...`.

Discover filters are remembered in `localStorage` under `kartlarla-dil:discover-filters:v1`. The initial filter falls back to
the authenticated profile preference, then to English A1.

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

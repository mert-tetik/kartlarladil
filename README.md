# Kartlarla Dil

Türk kullanıcılar için İngilizce, Almanca ve Rusça kelime kartı uygulaması. Kullanıcılar kart arar, rastgele kart çeker, kartları haznesine ekler ve quiz ile öğrenir.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui uyumlu component yapısı
- Zustand localStorage state
- Supabase-ready data layer
- Supabase Auth SSR helpers
- Vitest

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run report:cards
npm run test
npm run test:e2e
npm run build
```

## Product rules

- İlk diller: İngilizce, Almanca, Rusça.
- Kart tierları: A1, A2, B1, B2, C1.
- Doğru cevap eşikleri: A1 = 2, A2 = 3, B1 = 4, B2 = 5, C1 = 6.
- Kullanıcı kartı manuel olarak öğrenildi yapamaz.
- Yanlış cevap doğru sayacını 1 azaltır, minimum 0.
- Eşiğe ulaşan aktif kart otomatik öğrenildi olur.
- Katalog yalnızca tek kelimelik ana terimler içerir; ifade, kalıp ve cümle yapıları `term` alanına girmez.
- Starter katalog kalite önceliklidir; dil başına sabit 5.000 kart hedefi kovalanmaz.
- Her kartta 5 örnek kullanım ve dile/kelime türüne göre gramer anlatımı bulunur.
- Quiz sırasında detaylar cevap verilmeden gösterilmez; cevap sonrası öğrenme desteği olarak açılır.

## Project structure

```text
src/app                 route pages and root layout
src/components          shared layout and UI primitives
src/data                seed languages, tiers, generated starter catalog
src/features/auth       Supabase auth actions, forms, profile/account UI
src/features/cards      discovery and card UI
src/features/inventory  local inventory store and selectors
src/features/quiz       quiz engine and practice UI
src/lib                 utilities and future Supabase helpers
src/types               domain interfaces
supabase/migrations     Supabase-ready schema
docs                    architecture and Supabase notes
```

## Local data

MVP data is stored in the browser under:

```text
kartlarla-dil:v2
```

Use the reset button in inventory to clear local progress.

Run `npm run report:cards` to inspect the current catalog size, language/tier distribution, part-of-speech distribution, invalid terms, duplicates, and sample words.

## Supabase

Auth uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`.
Permanent account deletion additionally requires `SUPABASE_SERVICE_ROLE_KEY` on the server.

See `docs/SUPABASE.md` before applying the database migration to a real project.

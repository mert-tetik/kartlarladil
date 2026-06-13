# Kartlarla Dil

Kartlarla Dil, kullanıcıların çok dilli kelime haznesini koleksiyon kartlarıyla geliştirdiği bir Next.js uygulamasıdır. Kullanıcı kart çeker, kartı haznesine ekler, quiz çözer ve tier eşiğini tamamlayan kartlar otomatik öğrenilmiş olur.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui uyumlu component yapısı
- Zustand localStorage state
- Supabase Auth + Supabase-ready inventory
- Vitest

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run report:cards
npm run supabase:import-cards
npm run test
npm run test:e2e
npm run build
```

## Languages

Öğrenme dili ve arayüz dili olarak aynı 14 dil desteklenir:

Türkçe, İngilizce, Almanca, Rusça, Fransızca, İspanyolca, İtalyanca, Portekizce, Felemenkçe, Lehçe, Arapça, Japonca, Korece, Basitleştirilmiş Çince.

Arayüz dili navbar dil seçicisinden değiştirilir. Seçim cookie ve localStorage ile kalıcıdır; URL prefix kullanılmaz. Arapça seçilirse root `dir="rtl"` olur.

## Product Rules

- Kart tierları: A1, A2, B1, B2, C1.
- Doğru cevap eşikleri: A1 = 2, A2 = 3, B1 = 4, B2 = 5, C1 = 6.
- Kullanıcı kartı manuel olarak öğrenildi yapamaz.
- Yanlış cevap doğru sayacını 1 azaltır, minimum 0.
- Eşiğe ulaşan aktif kart otomatik öğrenildi olur.
- Öğrenilen kartlar tierına göre puan kazandırır: A1 = 10, A2 = 20, B1 = 40, B2 = 70, C1 = 110.
- Rank, öğrenilmiş kartlardan türetilen toplam puana göre hesaplanır; ayrı bir manuel puan sayacı tutulmaz.
- Quiz seçenekleri aktif arayüz dilinde gösterilir. Öğrenme dili ile arayüz dili aynıysa çalışma dili fallback kullanır: İngilizce için Türkçe, diğerleri için İngilizce.
- Quiz sırasında detaylar cevap verilmeden gösterilmez; cevap sonrası öğrenme desteği olarak açılır.

## Catalog

Katalog 14 ayrı seed dosyasından oluşur:

```text
src/data/card-seeds/tr.ts
src/data/card-seeds/en.ts
...
src/data/card-seeds/zh-CN.ts
```

Her dil dosyasında en az 2.000 strict single-word kart vardır. Ana `term` alanı boşluk, tire, noktalama veya sayı içermez. Sabit ifadeler için modelde `termKind: "fixed_phrase"` desteği vardır, fakat mevcut otomatik katalog 28.000 strict word kartından oluşur.

Katalog MUSE bilingual dictionary seed verisinden deterministik üretilir:

```bash
node scripts/generate-card-seeds-from-muse.mjs
```

`npm run report:cards` toplam sayıyı, dil/tier dağılımını, duplicate termleri, geçersiz termleri ve eksik locale çevirilerini raporlar.

## Local Data

Guest/local envanter tarayıcıda tutulur:

```text
kartlarla-dil:v3
```

Kart çek filtreleri ayrıca `kartlarla-dil:card-draw-filters:v1` altında saklanır.

## Supabase

Auth için `.env.local` içinde şu değerler gerekir:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` sadece server tarafında kullanılır. Canlı inventory için migrationlar uygulanmalı ve ardından katalog import edilmelidir:

```bash
npm run supabase:import-cards
```

Detaylar için `docs/SUPABASE.md`, mimari için `docs/ARCHITECTURE.md`, veri kaynağı için `docs/LEXICON_SOURCES.md` dosyalarına bak.

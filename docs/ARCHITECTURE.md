# Kartlarla Dil Architecture

Kartlarla Dil domain bazlı ayrılır: `cards`, `inventory`, `quiz`, `auth`, `progress` ve `i18n` kendi davranışlarını taşır. Route dosyaları mümkün olduğunca ince tutulur.

## Domain Model

- `LanguageCode` ve `LocaleCode` aynı 14 kodu kapsar: `tr`, `en`, `de`, `ru`, `fr`, `es`, `it`, `pt`, `nl`, `pl`, `ar`, `ja`, `ko`, `zh-CN`.
- `VocabularyCard` immutable katalog verisidir.
- `VocabularyCard.sourceKey` Supabase import için stabil anahtardır; local `id` aynı değeri kullanır.
- `termKind` `word` veya `fixed_phrase` olabilir. Mevcut katalog 28.000 `word` kartından oluşur.
- `translations` kart çevirilerini tüm locale’ler için tutar.
- `CardExample.translations` örnek cümle çevirilerini tüm locale’ler için tutar.
- `grammarByLocale` gramer anlatımını tüm locale’ler için tutar.
- Eski `translation`, `exampleTranslation` ve `grammar` alanları Türkçe fallback olarak korunur.

## Localization

`src/i18n` URL prefix kullanmadan locale yönetir.

- `getServerLocale()` cookie’den locale okur.
- Root layout `<html lang>` ve `dir` değerlerini server tarafında ayarlar.
- `LocaleProvider` client tarafında cookie/localStorage günceller.
- `useT()` UI dictionary stringlerini verir.
- Navbar’daki `LocaleSwitcher` tüm 14 locale’i listeler.

Kart çevirileri `src/features/cards/card-localization.ts` üzerinden okunur. Öğrenilen dil ile UI dili aynıysa quiz cevapları için fallback çalışma dili kullanılır: UI `en` ise `tr`, diğer aynı-dil durumlarında `en`.

## Data Flow

1. `src/data/card-seeds/*.ts` dosyaları kompakt seed satırlarını tutar.
2. `src/data/cards.ts` seed satırlarından lazy `VocabularyCard` objeleri üretir.
3. `localCardRepository` katalog üzerinde filtre, arama ve draw işlemlerini sağlar.
4. Guest inventory `localStorage` altında `kartlarla-dil:v3` ile tutulur.
5. Authenticated inventory Supabase `user_cards` ve `practice_attempts` tablolarından gelir.
6. Cloud inventory local `sourceKey` değerlerini Supabase `cards.id` UUID değerlerine `cards.source_key` ile map eder.

## Catalog Generation

`scripts/generate-card-seeds-from-muse.mjs` MUSE bilingual dictionary dosyalarını indirir ve `.tmp/muse-dictionaries` altında cache’ler. Script 14 dil için strict single-word filtresi uygular, her dilde 2.000 kart seçer ve seed dosyalarını yeniden yazar.

Katalog doğrulaması `npm run report:cards` ve `src/data/cards.test.ts` ile yapılır:

- Her dilde en az 2.000 `word` kartı.
- Her dilde tüm tier’larda kart.
- `word` için tek token kuralı.
- Tüm locale’lerde kart çevirisi.
- Her kartta 5 örnek ve tüm locale örnek çevirileri.
- Tüm locale’lerde gramer anlatımı.
- Duplicate `language + term` yok.
- Deterministik ve benzersiz `sourceKey`.

## Learning And Progress

Öğrenme kuralı `src/features/quiz/quiz-engine.ts` içindedir. UI kodu eşik ve status geçişini tekrar yazmamalıdır.

Puan ve rank ayrı mutable sayaç olarak tutulmaz. `ProgressStats` öğrenilmiş kartlar ve tier puanlarından türetilir:

- A1 = 10
- A2 = 20
- B1 = 40
- B2 = 70
- C1 = 110

Navbar, account menu ve `/profil` aynı progress kaynağını kullanır.

## UI Boundaries

- `VocabularyCardView` kartın tüm fiziksel/3D görünümünü sahiplenir.
- `CardDetailsDialog` 5 örnek ve gramer detayını gösterir.
- Quiz cevap verilmeden detay açmaz; cevap sonrası detay butonu gösterir.
- `FilterControls` öğrenme dili/tier seçimini yapar; mobilde dil dropdown kullanır.

## Auth Boundary

`src/lib/supabase` browser/server/admin/proxy clientlarını içerir. `src/features/auth/actions.ts` login, register, reset password, profile update, logout ve account deletion mutationlarını sahiplenir.

Client write actionları `useRequireAuthAction()` ile korunur. Guest kullanıcı kart ekleme, quiz cevabı kaydetme veya envanter sıfırlama gibi user-owned işlemlerde `/register?next=...` adresine gider.

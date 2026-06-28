# FoxiesDeck Architecture

FoxiesDeck domain bazli ayrilir: `cards`, `inventory`, `quiz`, `auth`, `progress` ve `i18n` kendi davranislarini tasir. Route dosyalari mumkun oldugunca ince tutulur.

## Domain Model

- `LanguageCode` ve `LocaleCode` ayni 14 kodu kapsar: `tr`, `en`, `de`, `ru`, `fr`, `es`, `it`, `pt`, `nl`, `pl`, `ar`, `ja`, `ko`, `zh-CN`.
- `VocabularyCard` immutable katalog verisidir.
- `VocabularyCard.sourceKey` app ve cloud save icin stabil anahtardir; local `id` ayni degeri kullanir.
- `termKind` `word` veya `fixed_phrase` olabilir. Mevcut katalog 28.000 `word` kartindan olusur.
- `translations` kart cevirilerini tum locale'ler icin tutar.
- `grammarByLocale` gramer anlatimini tum locale'ler icin tutar.
- Eski `translation` ve `grammar` alanlari Turkce fallback olarak korunur; `exampleTranslation` geriye donuk uyumluluk icin korunur ama user-facing akista kullanilmaz.
- `Tier` yalnizca kart zorlugu icindir (`A1`-`C1`).
- `preferred_tier` ise profil tercihidir; auth/profile katmaninda `all` degeri de kabul edilir.

## Localization

`src/i18n` URL prefix kullanmadan locale yonetir.

- `getServerLocale()` cookie'den locale okur.
- Root layout `<html lang>` ve `dir` degerlerini server tarafinda ayarlar.
- `LocaleProvider` client tarafinda cookie/localStorage gunceller.
- `useT()` UI dictionary stringlerini verir.
- Navbar'daki `LocaleSwitcher` tum 14 locale'i listeler.

Kart cevirileri `src/features/cards/card-localization.ts` uzerinden okunur. Ogrenilen dil ile UI dili ayniysa quiz cevaplari icin fallback calisma dili kullanilir: UI `en` ise `tr`, diger ayni-dil durumlarinda `en`.

## Data Flow

1. `src/data/card-seeds/*.ts` dosyalari kompakt seed satirlarini tutar.
2. `src/data/cards.ts` seed satirlarindan lazy `VocabularyCard` objeleri uretir.
3. `localCardRepository` katalog uzerinde filtre ve arama islemlerini saglar.
4. Guest inventory `localStorage` altinda `foxiesdeck:v3` ile tutulur.
5. Authenticated inventory Supabase `user_cards` ve `practice_attempts` tablolarindan gelir.
6. Cloud inventory `sourceKey` degerlerini dogrudan Supabase `user_cards.card_source_key` ve `practice_attempts.card_source_key` alanlarinda tutar.
7. Card draw varsayilan filtresi kullanici profilindeki `preferred_language_code` ve `preferred_tier` alanlarindan turetilir; `preferred_tier = 'all'` ise tum tier'lar varsayilan secilir.
8. Draw islemi `src/features/cards/draw-deck.ts` tarafindan cyclic deck mantigiyla yurutulur: cekilen kartlar `drawn` havuzuna, cekilmemis kartlar `remaining` havuzuna ayrilir; `remaining` bittiginde `drawn` havuzu karilarak yeni `remaining` olur. Deck durumu `localStorage` uzerinde her dil/tier kombinasyonu icin ayrı olarak saklanir.

## Catalog Generation

`scripts/generate-card-seeds-from-muse.mjs` MUSE bilingual dictionary dosyalarini indirir ve `.tmp/muse-dictionaries` altinda cache'ler. Script 14 dil icin strict single-word filtresi uygular, her dilde 2.000 kart secer ve seed dosyalarini yeniden yazar.

Katalog dogrulamasi `npm run report:cards` ve `src/data/cards.test.ts` ile yapilir:

- Her dilde en az 2.000 `word` karti.
- Her dilde tum tier'larda kart.
- `word` icin tek token kurali.
- Tum locale'lerde kart cevirisi.
- Her kartta 2 benzersiz ornek.
- Tum locale'lerde gramer anlatimi.
- Duplicate `language + term` yok.
- Deterministik ve benzersiz `sourceKey`.

## Learning And Progress

Ogrenme kurali `src/features/quiz/quiz-engine.ts` icindedir. UI kodu esik ve status gecisini tekrar yazmamalis.

Puan ve rank ayri mutable sayac olarak tutulmaz. `ProgressStats` ogrenilmis kartlar ve tier puanlarindan turetilir:

- A1 = 10
- A2 = 20
- B1 = 40
- B2 = 70
- C1 = 110

Navbar, account menu ve `/profile` ayni progress kaynagini kullanir.

## UI Boundaries

- `VocabularyCardView` kartin tum fiziksel/3D gorunumunu sahiplenir.
- `CardDetailsDialog` 2 ornek ve gramer detayini gosterir.
- Quiz cevap verilmeden detay acmaz; cevap sonrasi detay butonu gosterir.
- `FilterControls` ogrenme dili/tier secimini yapar; mobilde dil dropdown kullanir.

## Auth Boundary

`src/lib/supabase` browser/server/admin/proxy clientlarini icerir. `src/features/auth/actions.ts` login, register, reset password, profile update, logout ve account deletion mutationlarini sahiplenir.

Client write actionlari `useRequireAuthAction()` ile korunur. Guest kullanici kart ekleme, quiz cevabi kaydetme veya envanter sifirlama gibi user-owned islemlerde `/register?next=...` adresine gider.

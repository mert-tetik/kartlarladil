# Supabase Notes

Guest kullanicilarin envanteri localStorage'da kalir. Authenticated kullanicilarin envanteri, quiz denemeleri, progress stats, puan ve rank bilgisi Supabase tablolarindan turetilir.

## Environment Variables

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` sadece server tarafinda kullanilir. Client dosyalarina veya `NEXT_PUBLIC_` degiskenlerine konmaz.

## Auth Routes

- `/login`: email/password login.
- `/register`: email/password registration.
- `/reset-password`: reset email gonderimi.
- `/account/update-password`: reset linki veya oturum ici sifre guncelleme.
- `/account/settings`: profil ve hesap yonetimi.
- `/auth/callback`: Supabase PKCE callback.

Guest kullanici user-owned write action yaptiginda `/register?next=...` adresine yonlendirilir. `next` sadece internal path kabul eder.

Login/register default redirect hedefi `/card-draw` sayfasidir.

## Schema

Migrationlar:

- `0001_initial_schema.sql`: temel tablo, RLS ve grant yapisi.
- `0002_user_profile_preferences.sql`: profil tercih alanlari.
- `0003_multilingual_catalog_and_locale.sql`: 14 dil ve locale tercihi.
- `0013_card_source_key_compat.sql`: `card_source_key` uyumluluk kolonlari ve backfill.
- `0014_remove_cards_catalog.sql`: `public.cards` kaldirimi ve source key cleanup'i.
- `0015_allow_all_preferred_tier.sql`: `user_profiles.preferred_tier` alanina `"all"` secenegini ekler.

Tablolar:

- `languages`: public dil metadata'si.
- `user_profiles`: private kullanici profili ve tercihleri.
- `user_cards`: kullanici envanteri ve quiz progress'i (`card_source_key` ile local katalog kartina baglanir).
- `practice_attempts`: quiz cevap gecmisi (`card_source_key` ile local katalog kartina baglanir).

`user_profiles` icin:

- `preferred_language_code`: ogrenme dili.
- `preferred_tier`: kayitli tier tercihi (`A1`-`C1` veya `all`).
- `preferred_ui_locale`: arayuz dili.

## RLS

`languages` public read verisidir. `user_profiles`, `user_cards` ve `practice_attempts` sadece row sahibi tarafindan okunur/yazilir:

```sql
using ((select auth.uid()) = user_id)
```

Migrationlar `anon` ve `authenticated` icin explicit grants icerir. Supabase Data API exposure ayarlari yine dashboard'dan kontrol edilmelidir.

## Catalog Contract

Kart katalogu artik uygulama bundle'inda yasar. Supabase sadece kullanici state'ini tutar. Cloud action'lar gelen `sourceKey` degerini server bundle icindeki local katalog ile dogrular ve sadece `card_source_key` yazar.

## Stats

Puan ve rank ayri tabloya yazilmaz. Ogrenilmis kartlar `user_cards.status = 'learned'` ve app icindeki local katalog tier bilgisi uzerinden hesaplanir. Bu yapi duplicate puan ve client manipilasyonu riskini azaltir.

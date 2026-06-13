# Lexicon Sources

Katalog seed dosyaları `scripts/generate-card-seeds-from-muse.mjs` ile üretilir.

## Source

Script MUSE bilingual dictionary dosyalarını kullanır:

```text
https://dl.fbaipublicfiles.com/arrival/dictionaries/{source}-{target}.txt
```

Kullanılan yönler:

- `{locale}-en`
- `en-{locale}`

Bu iki yön birlikte her öğrenme dili için İngilizce pivot üzerinden 14 locale çevirisi üretir.

## Generation Rules

- Her desteklenen dil için 2.000 kart seçilir.
- `termKind` mevcut otomatik katalogda `word` olur.
- Ana `term` sadece Unicode harf/mark karakterlerinden oluşur.
- Boşluk, tire, noktalama, sayı ve cümleleşmiş kalıplar filtrelenir.
- Duplicate `language + term` kabul edilmez.
- Tier dağılımı eşittir: her dilde A1/A2/B1/B2/C1 için 400 kart.
- `sourceKey` dil, tier, term kind, term ve part of speech alanlarından deterministik üretilir.

## Quality Notes

MUSE sözlükleri büyük ve kullanışlı bir bootstrap kaynağıdır, fakat dil öğrenme ürünü için production kalitesi tamamen otomatik veriyle bitmiş sayılmamalıdır.

Önerilen sonraki aşamalar:

- A1/A2 listelerini öğretmen veya dil uzmanı kürasyonuyla yeniden sıralamak.
- Kelime türünü otomatik `kelime` yerine gerçek POS verisiyle zenginleştirmek.
- Sık kullanılan fixed phrase kartlarını ayrı `termKind: "fixed_phrase"` seed dosyasıyla eklemek.
- Kritik fiiller için curated çekim tabloları eklemek.
- Supabase import öncesi `npm run report:cards` çıktısını release checklist’e almak.

## Regeneration

Seedleri yeniden üretmek için:

```bash
node scripts/generate-card-seeds-from-muse.mjs
```

İndirilen kaynak dosyalar `.tmp/muse-dictionaries` altında cache’lenir ve git’e eklenmez.

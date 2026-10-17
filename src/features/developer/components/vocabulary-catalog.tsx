import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brackets,
  ChevronLeft,
  ChevronRight,
  Code2,
  Languages,
  Layers3,
  ListFilter,
  Quote,
  Search,
  Volume2,
} from "lucide-react";
import { CATALOG_REPORT, VOCABULARY_CARDS } from "@/data/cards";
import { getCardDefinition } from "@/data/card-definitions";
import { LANGUAGE_BY_CODE, LANGUAGE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import type { LocaleCode, TermKind, Tier, VocabularyCard } from "@/types/domain";

const PAGE_SIZE = 40;
const SEARCH_KEYS = ["q", "language", "tier", "kind", "partOfSpeech", "card", "page"] as const;
const numberFormatter = new Intl.NumberFormat("tr-TR");

type SearchParams = Record<string, string | string[] | undefined>;
type SearchKey = (typeof SEARCH_KEYS)[number];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function cleanSearchParams(searchParams: SearchParams) {
  const raw = Object.fromEntries(SEARCH_KEYS.map((key) => [key, firstParam(searchParams[key])]));
  const language = LANGUAGE_CODES.includes(raw.language as LocaleCode) ? raw.language : "";
  const tier = TIERS.includes(raw.tier as Tier) ? raw.tier : "";
  const kind = raw.kind === "word" || raw.kind === "fixed_phrase" ? raw.kind : "";
  const pageNumber = Number.parseInt(raw.page, 10);
  return {
    q: raw.q.trim(),
    language,
    tier,
    kind,
    partOfSpeech: raw.partOfSpeech.trim(),
    card: raw.card,
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  };
}

function buildCatalogHref(state: ReturnType<typeof cleanSearchParams>, overrides: Partial<Record<SearchKey, string | undefined>> = {}) {
  const values = { ...state, ...overrides };
  const params = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const value = values[key];
    if (value && String(value) !== "1") params.set(key, String(value));
  }
  const query = params.toString();
  return `/developer/vocabulary${query ? `?${query}` : ""}`;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function languageName(code: string) {
  return LANGUAGE_BY_CODE[code as LocaleCode]?.name ?? code;
}

function tierClass(tier: Tier) {
  const classes: Record<Tier, string> = {
    A1: "bg-[#e4f1e8] text-[#2f7251]",
    A2: "bg-[#e5eff7] text-[#23668b]",
    B1: "bg-[#fff0d9] text-[#9a5a08]",
    B2: "bg-[#f1e7f8] text-[#78448d]",
    C1: "bg-[#f9e2e2] text-[#a13b3b]",
  };
  return classes[tier];
}

function termKindLabel(kind: TermKind) {
  return kind === "fixed_phrase" ? "Sabit ifade" : "Kelime";
}

function matchesSearch(card: VocabularyCard, search: string) {
  if (!search) return true;
  const haystack = [
    card.term,
    card.englishKey,
    card.partOfSpeech,
    card.sourceKey,
    ...Object.values(card.translations),
  ].join(" ").toLocaleLowerCase();
  return haystack.includes(search.toLocaleLowerCase());
}

function getFilteredCards(state: ReturnType<typeof cleanSearchParams>) {
  return VOCABULARY_CARDS.filter((card) => {
    if (state.language && card.language !== state.language) return false;
    if (state.tier && card.tier !== state.tier) return false;
    if (state.kind && card.termKind !== state.kind) return false;
    if (state.partOfSpeech && card.partOfSpeech !== state.partOfSpeech) return false;
    return matchesSearch(card, state.q);
  });
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <article className={`rounded-xl p-4 text-white ${tone}`}><p className="text-xs font-medium text-white/80">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-white/75">{detail}</p></article>;
}

function FilterBar({ state, partsOfSpeech }: { state: ReturnType<typeof cleanSearchParams>; partsOfSpeech: string[] }) {
  return <form action="/developer/vocabulary" className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-4" method="get">
    <div className="flex items-center gap-2 text-sm font-semibold text-[#26342b]"><ListFilter className="size-4 text-[#2f7251]" aria-hidden="true" />Katalogı filtrele</div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.6fr)_repeat(4,minmax(8rem,1fr))_auto]">
      <label className="relative block"><span className="sr-only">Kelime ara</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a958d]" aria-hidden="true" /><input className="h-10 w-full rounded-lg border border-[#cfd7ce] bg-white pl-9 pr-3 text-sm text-[#26342b] outline-none transition-colors placeholder:text-[#9aa59d] focus:border-[#2f7251]" defaultValue={state.q} name="q" placeholder="Kelime, çeviri, tür veya sourceKey ara…" type="search" /></label>
      <label className="block"><span className="sr-only">Öğrenme dili</span><select className="h-10 w-full rounded-lg border border-[#cfd7ce] bg-white px-3 text-sm text-[#405548] outline-none focus:border-[#2f7251]" defaultValue={state.language} name="language"><option value="">Tüm diller</option>{LANGUAGE_CODES.map((code) => <option key={code} value={code}>{languageName(code)}</option>)}</select></label>
      <label className="block"><span className="sr-only">Seviye</span><select className="h-10 w-full rounded-lg border border-[#cfd7ce] bg-white px-3 text-sm text-[#405548] outline-none focus:border-[#2f7251]" defaultValue={state.tier} name="tier"><option value="">Tüm seviyeler</option>{TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
      <label className="block"><span className="sr-only">Kart türü</span><select className="h-10 w-full rounded-lg border border-[#cfd7ce] bg-white px-3 text-sm text-[#405548] outline-none focus:border-[#2f7251]" defaultValue={state.kind} name="kind"><option value="">Tüm türler</option><option value="word">Kelime</option><option value="fixed_phrase">Sabit ifade</option></select></label>
      <label className="block"><span className="sr-only">Kelime türü</span><select className="h-10 w-full rounded-lg border border-[#cfd7ce] bg-white px-3 text-sm text-[#405548] outline-none focus:border-[#2f7251]" defaultValue={state.partOfSpeech} name="partOfSpeech"><option value="">Tüm kelime türleri</option>{partsOfSpeech.map((partOfSpeech) => <option key={partOfSpeech} value={partOfSpeech}>{partOfSpeech}</option>)}</select></label>
      <div className="flex items-center gap-2"><button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2f7251] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#245d41]" type="submit"><Search className="size-4" aria-hidden="true" />Ara</button><Link className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-[#66746a] hover:bg-[#eef2ec]" href="/developer/vocabulary">Temizle</Link></div>
    </div>
  </form>;
}

function CatalogTable({ cards, state, total }: { cards: VocabularyCard[]; state: ReturnType<typeof cleanSearchParams>; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(state.page, totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);
  return <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8]">
    <div className="flex flex-col gap-2 border-b border-[#e5e9e2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-[#26342b]">Kelime listesi</h2><p className="mt-1 text-xs text-[#89938b]">{total ? `${formatNumber(start)}–${formatNumber(end)} / ${formatNumber(total)} sonuç` : "Filtrelere uyan kelime yok"}</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e7f1e8] px-2.5 py-1 text-[11px] font-semibold text-[#2f7251]"><span className="size-1.5 rounded-full bg-current" />Salt okunur</span></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[920px] border-collapse text-left"><thead className="bg-[#f3f6f1] text-[11px] font-semibold text-[#718078]"><tr><th className="px-4 py-3">Kelime</th><th className="px-4 py-3">Referans</th><th className="px-4 py-3">Dil</th><th className="px-4 py-3">Seviye</th><th className="px-4 py-3">Kelime türü</th><th className="px-4 py-3">Telaffuz</th><th className="px-4 py-3 text-right">Detay</th></tr></thead><tbody className="divide-y divide-[#edf0eb]">{cards.map((card) => { const selected = state.card === card.sourceKey; return <tr className={selected ? "bg-[#e7f2e9]" : "transition-colors hover:bg-[#f5f8f3]"} key={card.sourceKey}><td className="px-4 py-3.5"><Link className="group block" href={buildCatalogHref(state, { card: card.sourceKey, page: String(currentPage) })}><span className="block max-w-[15rem] truncate text-sm font-semibold text-[#26342b] group-hover:text-[#2f7251]">{card.term}</span><span className="mt-1 block max-w-[18rem] truncate font-mono text-[10px] text-[#9aa59d]">{card.sourceKey}</span></Link></td><td className="px-4 py-3.5 text-sm text-[#58665c]">{card.englishKey}</td><td className="px-4 py-3.5"><span className="text-sm font-medium text-[#405548]">{languageName(card.language)}</span><span className="mt-0.5 block text-[10px] uppercase text-[#9aa59d]">{card.language}</span></td><td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tierClass(card.tier)}`}>{card.tier}</span></td><td className="px-4 py-3.5"><span className="text-sm text-[#58665c]">{termKindLabel(card.termKind)}</span><span className="mt-0.5 block text-[10px] text-[#9aa59d]">{card.partOfSpeech}</span></td><td className="px-4 py-3.5 font-mono text-xs text-[#657168]">{card.pronunciation || "—"}</td><td className="px-4 py-3.5 text-right"><Link aria-label={`${card.term} detayını aç`} className="inline-flex rounded-md p-2 text-[#718078] hover:bg-[#e1eee3] hover:text-[#2f7251]" href={buildCatalogHref(state, { card: card.sourceKey, page: String(currentPage) })}><ChevronRight className="size-4" aria-hidden="true" /></Link></td></tr>; })}</tbody></table></div>
    {!cards.length ? <div className="grid min-h-56 place-items-center px-6 text-center"><div><BookOpen className="mx-auto size-8 text-[#9aa59d]" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-[#405548]">Sonuç bulunamadı</p><p className="mt-1 text-xs text-[#89938b]">Arama veya filtreleri değiştirerek tekrar deneyebilirsin.</p></div></div> : null}
    <div className="flex items-center justify-between border-t border-[#e5e9e2] px-4 py-3"><span className="text-xs text-[#89938b]">Sayfa {formatNumber(currentPage)} / {formatNumber(totalPages)}</span><div className="flex items-center gap-1.5"><Link aria-disabled={currentPage <= 1} className={`inline-flex size-8 items-center justify-center rounded-md border border-[#d9e0d7] ${currentPage <= 1 ? "pointer-events-none text-[#c0c8c1]" : "text-[#536158] hover:bg-[#eef3ed]"}`} href={buildCatalogHref(state, { page: String(Math.max(1, currentPage - 1)) })}><ChevronLeft className="size-4" aria-hidden="true" /></Link><Link aria-disabled={currentPage >= totalPages} className={`inline-flex size-8 items-center justify-center rounded-md border border-[#d9e0d7] ${currentPage >= totalPages ? "pointer-events-none text-[#c0c8c1]" : "text-[#536158] hover:bg-[#eef3ed]"}`} href={buildCatalogHref(state, { page: String(Math.min(totalPages, currentPage + 1)) })}><ChevronRight className="size-4" aria-hidden="true" /></Link></div></div>
  </section>;
}

function DetailSection({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: ReactNode }) {
  return <section className="border-t border-[#e5e9e2] pt-5"><div className="flex items-center gap-2 text-xs font-semibold text-[#405548]"><Icon className="size-4 text-[#2f7251]" aria-hidden="true" />{title}</div><div className="mt-3">{children}</div></section>;
}

function CardDetail({ card }: { card: VocabularyCard }) {
  const definition = getCardDefinition(card, card.language) ?? getCardDefinition(card, "en");
  const grammar = card.grammarByLocale[card.language] ?? card.grammar;
  const meanings = card.translationMeaningsByLocale[card.language] ?? [];
  return <aside className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5 xl:sticky xl:top-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-[#7b867e]">Seçili kart</p><h2 className="mt-2 break-words font-display text-3xl font-semibold leading-tight text-[#26342b]">{card.term}</h2><p className="mt-2 text-sm text-[#718078]">{languageName(card.language)} · {card.englishKey}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tierClass(card.tier)}`}>{card.tier}</span></div>
    <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#eef3ed] p-3"><p className="text-[10px] text-[#89938b]">Kelime türü</p><p className="mt-1 text-sm font-semibold text-[#405548]">{card.partOfSpeech}</p></div><div className="rounded-lg bg-[#eef3ed] p-3"><p className="text-[10px] text-[#89938b]">Kart tipi</p><p className="mt-1 text-sm font-semibold text-[#405548]">{termKindLabel(card.termKind)}</p></div></div>
    <DetailSection icon={Volume2} title="Pronunciation"><p className="rounded-lg bg-[#17261e] px-3 py-3 font-mono text-sm text-white">{card.pronunciation || "Bu kart için pronunciation kaydı yok."}</p></DetailSection>
    <DetailSection icon={Quote} title="Örnek cümleler"><div className="space-y-2">{card.examples.length ? card.examples.map((example) => <div className="rounded-lg bg-[#f2f6f1] p-3" key={example.id}><p className="text-[10px] font-semibold text-[#2f7251]">{example.label}</p><p className="mt-1 text-sm leading-6 text-[#405548]">{example.sentence}</p>{example.translation ? <p className="mt-1 text-xs leading-5 text-[#89938b]">{example.translation}</p> : null}</div>) : <p className="text-sm text-[#89938b]">Bu kart için örnek cümle bulunamadı.</p>}</div></DetailSection>
    <DetailSection icon={Brackets} title="Tanım ve anlamlar"><div className="space-y-3">{definition ? <p className="text-sm leading-6 text-[#58665c]">{definition}</p> : <p className="text-sm text-[#89938b]">Bu locale için tanım kaydı bulunamadı.</p>}{meanings.length ? <ul className="space-y-1.5 text-sm text-[#58665c]">{meanings.map((meaning) => <li className="flex gap-2" key={meaning}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#2f7251]" />{meaning}</li>)}</ul> : null}</div></DetailSection>
    <DetailSection icon={Languages} title="Çeviriler"><div className="grid gap-1.5 sm:grid-cols-2">{LANGUAGE_CODES.map((locale) => <div className="flex items-start justify-between gap-3 rounded-md bg-[#f6f8f4] px-2.5 py-2" key={locale}><span className="text-[11px] font-semibold text-[#89938b]">{locale}</span><span className="text-right text-xs text-[#405548]">{card.translations[locale]}</span></div>)}</div></DetailSection>
    <DetailSection icon={Layers3} title="Grammar"><div className="space-y-2 text-sm text-[#58665c]">{grammar.summary ? <p>{grammar.summary}</p> : null}{grammar.rules.length ? <ul className="space-y-1.5">{grammar.rules.slice(0, 6).map((rule) => <li className="flex gap-2" key={rule}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#2f7251]" />{rule}</li>)}</ul> : <p className="text-[#89938b]">Grammar kuralı bulunamadı.</p>}</div></DetailSection>
    <div className="mt-5 rounded-lg bg-[#f1eee5] p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-[#6f684f]"><Code2 className="size-3.5" aria-hidden="true" />Düzenleme referansı</div><code className="mt-2 block break-all text-[11px] leading-5 text-[#6f684f]">{card.sourceKey}</code><p className="mt-2 text-[11px] leading-5 text-[#8b8572]">Değişiklik talebi verirken bu sourceKey’i kullan.</p></div>
  </aside>;
}

export function VocabularyCatalog({ searchParams }: { searchParams: SearchParams }) {
  const state = cleanSearchParams(searchParams);
  const filteredCards = getFilteredCards(state);
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const currentPage = Math.min(state.page, totalPages);
  const pageCards = filteredCards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedCard = state.card ? VOCABULARY_CARDS.find((card) => card.sourceKey === state.card) ?? null : null;
  const partsOfSpeech = [...new Set(VOCABULARY_CARDS.map((card) => card.partOfSpeech).filter(Boolean))].sort((first, second) => first.localeCompare(second));
  const cardsWithExamples = VOCABULARY_CARDS.filter((card) => card.examples.length > 0).length;
  const cardsWithPronunciation = VOCABULARY_CARDS.filter((card) => card.pronunciation.trim()).length;

  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-7 text-[#1f2922] sm:px-6 lg:px-10"><div className="mx-auto max-w-[112rem]">
    <header className="border-b border-[#d9ddd4] pb-7"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f6657] hover:underline" href="/developer"><ArrowLeft className="size-4" aria-hidden="true" />Developer workspace</Link><div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-[#2f7251]">Content catalog</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Vocabulary catalog</h1><p className="mt-3 max-w-3xl text-base leading-7 text-[#58665c]">Ana kelime listesini, bağlı örnekleri ve dil verilerini tek bir okunabilir katalogda incele.</p></div><div className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#17261e] px-3 py-2 text-xs font-semibold text-white"><BookOpen className="size-4 text-[#9bd0aa]" aria-hidden="true" />Salt okunur görünüm</div></div></header>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Vocabulary catalog summary"><StatCard label="Toplam kart" value={formatNumber(CATALOG_REPORT.total)} detail="Ana katalog girdisi" tone="bg-[#2f7251]" /><StatCard label="Dil varyasyonu" value={formatNumber(Object.keys(CATALOG_REPORT.byLanguage).length)} detail="Desteklenen öğrenme dili" tone="bg-[#287ea5]" /><StatCard label="Örnek cümleli" value={formatNumber(cardsWithExamples)} detail={`${formatNumber(Math.round((cardsWithExamples / Math.max(1, CATALOG_REPORT.total)) * 100))}% katalog kapsamı`} tone="bg-[#a45d1b]" /><StatCard label="Pronunciation kayıtlı" value={formatNumber(cardsWithPronunciation)} detail={`${formatNumber(partsOfSpeech.length)} kelime türü`} tone="bg-[#74489a]" /></section>
    <div className="mt-5"><FilterBar partsOfSpeech={partsOfSpeech} state={state} /></div>
    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(23rem,0.76fr)]"><CatalogTable cards={pageCards} state={{ ...state, page: currentPage }} total={filteredCards.length} />{selectedCard ? <CardDetail card={selectedCard} /> : <aside className="rounded-xl border border-dashed border-[#cbd5ca] bg-[#eef3ed] p-6 xl:sticky xl:top-5"><BookOpen className="size-8 text-[#2f7251]" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-[#26342b]">Bir kart seç</h2><p className="mt-2 text-sm leading-6 text-[#657168]">Listedeki herhangi bir kelimeye tıklayınca pronunciation, örnek cümleler, çeviriler, tanım ve grammar bilgileri burada açılır.</p></aside>}</div>
  </div></main>;
}

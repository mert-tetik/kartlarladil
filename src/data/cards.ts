import { CARD_SEED_MODULES } from "./card-seeds";
import { rowToTranslations } from "./card-seeds/types";
import { LANGUAGE_CODES, LOCALE_CODES } from "./languages";
import type {
  CardExample,
  GrammarGuide,
  LanguageCode,
  LocaleCode,
  TermKind,
  Tier,
  VocabularyCard,
} from "@/types/domain";

type PartOfSpeechGroup = "word" | "phrase";

interface CardBuildInput {
  id: string;
  sourceKey: string;
  englishKey: string;
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  term: string;
  translations: Record<LocaleCode, string>;
  pronunciation: string;
  partOfSpeech: string;
}

export interface CatalogReport {
  total: number;
  byLanguage: Record<LanguageCode, number>;
  byLanguageTier: Record<LanguageCode, Record<Tier, number>>;
  byPartOfSpeech: Record<string, number>;
  strictWordCountByLanguage: Record<LanguageCode, number>;
  fixedPhraseCountByLanguage: Record<LanguageCode, number>;
  invalidTerms: Array<Pick<VocabularyCard, "id" | "language" | "tier" | "term" | "termKind">>;
  duplicateTerms: Array<{ language: LanguageCode; term: string; ids: string[] }>;
  missingTranslations: Array<{ id: string; locale: LocaleCode }>;
  samples: Record<LanguageCode, string[]>;
}

const TIERS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];
const SINGLE_WORD_PATTERN = /^[\p{L}\p{M}]+$/u;
const FIXED_PHRASE_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[-'\s…][\p{L}\p{M}\p{N}]+){1,3}[-'\s…]?$/u;
const WORD_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[-'\s…][\p{L}\p{M}\p{N}]+){0,3}[-'\s…]?$/u;
const EXAMPLE_CONTEXTS: CardExample["context"][] = ["daily", "question", "negative", "contextual", "natural"];
const A1_EXAMPLE_CONTEXTS: CardExample["context"][] = ["daily"];

const EXAMPLE_LABELS: Record<CardExample["context"], Record<LocaleCode, string>> = {
  daily: labels("Günlük kullanım", "Daily use", "Alltag", "Повседневно", "Usage quotidien", "Uso diario"),
  question: labels("Soru", "Question", "Frage", "Вопрос", "Question", "Pregunta"),
  negative: labels("Olumsuz", "Negative", "Negativ", "Отрицание", "Négation", "Negativo"),
  contextual: labels("Bağlam", "Context", "Kontext", "Контекст", "Contexte", "Contexto"),
  natural: labels("Doğal kullanım", "Natural use", "Natürliche Nutzung", "Естественное употребление", "Usage naturel", "Uso natural"),
};

export function isSingleWordTerm(term: string): boolean {
  return SINGLE_WORD_PATTERN.test(term.normalize("NFC"));
}

export function isFixedPhraseTerm(term: string): boolean {
  return FIXED_PHRASE_PATTERN.test(term.normalize("NFC"));
}

export function isValidCardTerm(term: string, termKind: TermKind): boolean {
  return termKind === "word" ? WORD_PATTERN.test(term.normalize("NFC")) : FIXED_PHRASE_PATTERN.test(term.normalize("NFC"));
}

export function createCardSourceKey(
  language: LanguageCode,
  tier: Tier,
  term: string,
  partOfSpeech: string,
  termKind: TermKind = "word",
) {
  return [language, tier, termKind, encodeKeyPart(term), encodeKeyPart(partOfSpeech)].join(":");
}

export function getCatalogReport(cards: VocabularyCard[]): CatalogReport {
  const byLanguage = emptyLanguageCount();
  const byLanguageTier = emptyLanguageTierCount();
  const byPartOfSpeech: Record<string, number> = {};
  const strictWordCountByLanguage = emptyLanguageCount();
  const fixedPhraseCountByLanguage = emptyLanguageCount();
  const termMap = new Map<string, string[]>();
  const missingTranslations: CatalogReport["missingTranslations"] = [];

  for (const card of cards) {
    byLanguage[card.language] += 1;
    byLanguageTier[card.language][card.tier] += 1;
    byPartOfSpeech[card.partOfSpeech] = (byPartOfSpeech[card.partOfSpeech] ?? 0) + 1;

    if (card.termKind === "word") {
      strictWordCountByLanguage[card.language] += 1;
    } else {
      fixedPhraseCountByLanguage[card.language] += 1;
    }

    for (const locale of LOCALE_CODES) {
      if (!card.translations[locale]?.trim()) {
        missingTranslations.push({ id: card.id, locale });
      }
    }

    const duplicateKey = `${card.language}:${card.term.toLocaleLowerCase("en")}`;
    termMap.set(duplicateKey, [...(termMap.get(duplicateKey) ?? []), card.id]);
  }

  const duplicateTerms = [...termMap.entries()].flatMap(([key, ids]) => {
    if (ids.length < 2) {
      return [];
    }

    const [language, term] = key.split(":") as [LanguageCode, string];
    return [{ language, term, ids }];
  });

  return {
    total: cards.length,
    byLanguage,
    byLanguageTier,
    byPartOfSpeech,
    strictWordCountByLanguage,
    fixedPhraseCountByLanguage,
    invalidTerms: cards
      .filter((card) => !isValidCardTerm(card.term, card.termKind))
      .map(({ id, language, tier, term, termKind }) => ({ id, language, tier, term, termKind })),
    duplicateTerms,
    missingTranslations,
    samples: Object.fromEntries(
      LANGUAGE_CODES.map((language) => [
        language,
        cards.filter((card) => card.language === language).slice(0, 12).map((card) => card.term),
      ]),
    ) as Record<LanguageCode, string[]>,
  };
}

function buildCatalog(): VocabularyCard[] {
  return CARD_SEED_MODULES.flatMap((module) =>
    module.rows.map((row) => {
      const [englishKey, tier, termKind, partOfSpeech, pronunciation] = row;
      const translations = rowToTranslations(row);
      const term = translations[module.language];
      const sourceKey = createCardSourceKey(module.language, tier, englishKey, partOfSpeech, termKind);

      return createVocabularyCard({
        id: sourceKey,
        sourceKey,
        englishKey,
        language: module.language,
        tier,
        termKind,
        term,
        translations,
        pronunciation,
        partOfSpeech,
      });
    }),
  );
}

function createVocabularyCard(input: CardBuildInput): VocabularyCard {
  let examples: CardExample[] | undefined;
  let grammarByLocale: Record<LocaleCode, GrammarGuide> | undefined;
  const exampleContexts = input.tier === "A1" ? A1_EXAMPLE_CONTEXTS : EXAMPLE_CONTEXTS;

  const firstExample = buildSourceExample(input.language, input.term, input.tier, "daily");
  const firstExampleTranslations = buildExampleTranslations(input, "daily");

  return {
    ...input,
    translation: input.translations.tr,
    example: firstExample,
    exampleTranslation: firstExampleTranslations.tr,
    get examples() {
      examples ??= exampleContexts.map((context) => ({
        id: context,
        context,
        label: EXAMPLE_LABELS[context].tr,
        sentence: buildSourceExample(input.language, input.term, input.tier, context),
        translation: buildExampleTranslations(input, context).tr,
        translations: buildExampleTranslations(input, context),
      }));
      return examples;
    },
    get grammar() {
      return this.grammarByLocale.tr;
    },
    get grammarByLocale() {
      grammarByLocale ??= Object.fromEntries(
        LOCALE_CODES.map((locale) => [locale, buildGrammarGuide(input, locale)]),
      ) as Record<LocaleCode, GrammarGuide>;
      return grammarByLocale;
    },
  };
}

function buildSourceExample(language: LanguageCode, term: string, tier: Tier, context: CardExample["context"]) {
  if (context === "daily") {
    const dailyVariants = DAILY_SOURCE_VARIANTS[language] ?? DAILY_SOURCE_VARIANTS.en;
    return dailyVariants[stableIndex(`${language}:${term}:daily`, dailyVariants.length)](term, tier);
  }

  const templates = SOURCE_EXAMPLE_TEMPLATES[language] ?? SOURCE_EXAMPLE_TEMPLATES.en;
  return templates[context](term, tier);
}

function buildExampleTranslations(input: CardBuildInput, context: CardExample["context"]): Record<LocaleCode, string> {
  return Object.fromEntries(
    LOCALE_CODES.map((locale) => {
      const term = input.translations[locale] || input.term;
      const templates = TRANSLATED_EXAMPLE_TEMPLATES[locale] ?? TRANSLATED_EXAMPLE_TEMPLATES.en;
      return [locale, templates[context](term, input.tier)];
    }),
  ) as Record<LocaleCode, string>;
}

function buildGrammarGuide(input: CardBuildInput, locale: LocaleCode): GrammarGuide {
  const term = input.translations[locale] || input.term;
  const builders = GRAMMAR_BUILDERS[locale] ?? GRAMMAR_BUILDERS.en;
  return builders(term, input.tier, getPartOfSpeechGroup(input.termKind));
}

function labels(
  tr: string,
  en: string,
  de: string,
  ru: string,
  fr: string,
  es: string,
): Record<LocaleCode, string> {
  return {
    tr,
    en,
    de,
    ru,
    fr,
    es,
    it: en,
    pt: es,
    nl: en,
    pl: en,
    ar: en,
    ja: en,
    ko: en,
    "zh-CN": en,
  };
}

function getPartOfSpeechGroup(termKind: TermKind): PartOfSpeechGroup {
  return termKind === "fixed_phrase" ? "phrase" : "word";
}

type SourceExampleTemplate = (term: string, tier: Tier) => string;
type ContextTemplates = Record<CardExample["context"], SourceExampleTemplate>;

const DAILY_SOURCE_VARIANTS: Record<LanguageCode, SourceExampleTemplate[]> = {
  tr: [
    (term) => `Bugünkü derste "${term}" kelimesini not ettim.`,
    (term) => `Kısa metinde "${term}" kelimesi gözüme çarptı.`,
    (term) => `"${term}" yeni kart destemde yerini aldı.`,
    (term) => `Örnek konuşmada "${term}" kelimesini duydum.`,
    (term) => `Tekrar listeme "${term}" kelimesini ekledim.`,
  ],
  en: [
    (term) => `Today I added "${term}" to my study list.`,
    (term) => `I noticed "${term}" in a short reading task.`,
    (term) => `"${term}" now belongs to my card deck.`,
    (term) => `The speaker used "${term}" in a simple exchange.`,
    (term) => `I reviewed "${term}" before the next quiz.`,
  ],
  de: [
    (term) => `Heute steht "${term}" auf meiner Lernliste.`,
    (term) => `Im kurzen Text fällt mir "${term}" auf.`,
    (term) => `"${term}" liegt jetzt in meinem Kartendeck.`,
    (term) => `Im Gespräch höre ich "${term}" deutlich.`,
    (term) => `Vor dem Quiz wiederhole ich "${term}".`,
  ],
  ru: [
    (term) => `Сегодня я добавил «${term}» в список слов.`,
    (term) => `В коротком тексте я заметил «${term}».`,
    (term) => `«${term}» теперь есть в моей колоде.`,
    (term) => `В диалоге я слышу «${term}» ясно.`,
    (term) => `Перед quiz я повторяю «${term}».`,
  ],
  fr: [
    (term) => `Aujourd'hui, j'ajoute "${term}" à ma liste.`,
    (term) => `Je remarque "${term}" dans un texte court.`,
    (term) => `"${term}" entre dans mon deck de cartes.`,
    (term) => `J'entends "${term}" dans un échange simple.`,
    (term) => `Je révise "${term}" avant le quiz.`,
  ],
  es: [
    (term) => `Hoy añadí "${term}" a mi lista.`,
    (term) => `Noté "${term}" en un texto breve.`,
    (term) => `"${term}" ya está en mi mazo.`,
    (term) => `Escuché "${term}" en un diálogo sencillo.`,
    (term) => `Repasé "${term}" antes del quiz.`,
  ],
  it: [
    (term) => `Oggi aggiungo "${term}" alla mia lista.`,
    (term) => `Noto "${term}" in un testo breve.`,
    (term) => `"${term}" entra nel mio mazzo.`,
    (term) => `Sento "${term}" in uno scambio semplice.`,
    (term) => `Ripasso "${term}" prima del quiz.`,
  ],
  pt: [
    (term) => `Hoje adicionei "${term}" à minha lista.`,
    (term) => `Notei "${term}" num texto curto.`,
    (term) => `"${term}" entrou no meu baralho.`,
    (term) => `Ouvi "${term}" numa conversa simples.`,
    (term) => `Revi "${term}" antes do quiz.`,
  ],
  nl: [
    (term) => `Vandaag zet ik "${term}" op mijn lijst.`,
    (term) => `Ik merk "${term}" op in een korte tekst.`,
    (term) => `"${term}" zit nu in mijn kaartendeck.`,
    (term) => `Ik hoor "${term}" in een eenvoudig gesprek.`,
    (term) => `Ik herhaal "${term}" voor de quiz.`,
  ],
  pl: [
    (term) => `Dzisiaj dodaję "${term}" do listy.`,
    (term) => `Zauważam "${term}" w krótkim tekście.`,
    (term) => `"${term}" trafia do mojej talii.`,
    (term) => `Słyszę "${term}" w prostym dialogu.`,
    (term) => `Powtarzam "${term}" przed quizem.`,
  ],
  ar: [
    (term) => `أضفت "${term}" إلى قائمة الدراسة اليوم.`,
    (term) => `لاحظت "${term}" في نص قصير.`,
    (term) => `أصبحت "${term}" ضمن مجموعة البطاقات.`,
    (term) => `سمعت "${term}" في حوار بسيط.`,
    (term) => `راجعت "${term}" قبل الاختبار.`,
  ],
  ja: [
    (term) => `今日は「${term}」を学習リストに入れました。`,
    (term) => `短い文章で「${term}」に気づきました。`,
    (term) => `「${term}」がカードデッキに入りました。`,
    (term) => `簡単な会話で「${term}」を聞きました。`,
    (term) => `クイズ前に「${term}」を復習しました。`,
  ],
  ko: [
    (term) => `오늘 "${term}"을 학습 목록에 넣었습니다.`,
    (term) => `짧은 글에서 "${term}"을 확인했습니다.`,
    (term) => `"${term}"이 카드 덱에 들어갔습니다.`,
    (term) => `간단한 대화에서 "${term}"을 들었습니다.`,
    (term) => `퀴즈 전에 "${term}"을 복습했습니다.`,
  ],
  "zh-CN": [
    (term) => `今天我把“${term}”加入学习列表。`,
    (term) => `我在短文里注意到“${term}”。`,
    (term) => `“${term}”已经进入我的卡组。`,
    (term) => `我在简单对话中听到“${term}”。`,
    (term) => `测验前我复习了“${term}”。`,
  ],
};

const SOURCE_EXAMPLE_TEMPLATES: Record<LanguageCode, ContextTemplates> = {
  tr: sourceTemplates({
    daily: (term) => `Bugünkü derste "${term}" kelimesini not ettim.`,
    question: (term) => `"${term}" kelimesi bu cümlede ne anlama geliyor?`,
    negative: (term) => `"${term}" kelimesini bağlam olmadan çevirmiyorum.`,
    contextual: (term, tier) => `${tier} seviyesinde "${term}" farklı bir bağlamda görünür.`,
    natural: (term) => `Konuşmada "${term}" doğal bir şekilde geçer.`,
  }),
  en: sourceTemplates({
    daily: (term) => `Today I added "${term}" to my study list.`,
    question: (term) => `What does "${term}" mean in this sentence?`,
    negative: (term) => `Do not translate "${term}" without context.`,
    contextual: (term, tier) => `At ${tier} level, "${term}" appears in a new context.`,
    natural: (term) => `Native speakers use "${term}" naturally in conversation.`,
  }),
  de: sourceTemplates({
    daily: (term) => `Heute steht "${term}" auf meiner Lernliste.`,
    question: (term) => `Was bedeutet "${term}" in diesem Satz?`,
    negative: (term) => `Übersetze "${term}" nicht ohne Kontext.`,
    contextual: (term, tier) => `Auf dem Niveau ${tier} erscheint "${term}" in einem neuen Kontext.`,
    natural: (term) => `"${term}" klingt in einem klaren Gespräch natürlich.`,
  }),
  ru: sourceTemplates({
    daily: (term) => `Сегодня я добавил «${term}» в список слов.`,
    question: (term) => `Что значит «${term}» в этом предложении?`,
    negative: (term) => `Не переводи «${term}» без контекста.`,
    contextual: (term, tier) => `На уровне ${tier} «${term}» появляется в новом контексте.`,
    natural: (term) => `В живой речи «${term}» звучит естественно.`,
  }),
  fr: sourceTemplates({
    daily: (term) => `Aujourd'hui, j'ajoute "${term}" à ma liste.`,
    question: (term) => `Que signifie "${term}" dans cette phrase ?`,
    negative: (term) => `Ne traduis pas "${term}" sans contexte.`,
    contextual: (term, tier) => `Au niveau ${tier}, "${term}" apparaît dans un nouveau contexte.`,
    natural: (term) => `"${term}" semble naturel dans une conversation claire.`,
  }),
  es: sourceTemplates({
    daily: (term) => `Hoy añadí "${term}" a mi lista.`,
    question: (term) => `¿Qué significa "${term}" en esta frase?`,
    negative: (term) => `No traduzcas "${term}" sin contexto.`,
    contextual: (term, tier) => `En el nivel ${tier}, "${term}" aparece en un contexto nuevo.`,
    natural: (term) => `"${term}" suena natural en una conversación clara.`,
  }),
  it: sourceTemplates({
    daily: (term) => `Oggi aggiungo "${term}" alla mia lista.`,
    question: (term) => `Che cosa significa "${term}" in questa frase?`,
    negative: (term) => `Non tradurre "${term}" senza contesto.`,
    contextual: (term, tier) => `Al livello ${tier}, "${term}" appare in un nuovo contesto.`,
    natural: (term) => `"${term}" suona naturale in una conversazione chiara.`,
  }),
  pt: sourceTemplates({
    daily: (term) => `Hoje adicionei "${term}" à minha lista.`,
    question: (term) => `O que significa "${term}" nesta frase?`,
    negative: (term) => `Não traduzas "${term}" sem contexto.`,
    contextual: (term, tier) => `No nível ${tier}, "${term}" aparece num novo contexto.`,
    natural: (term) => `"${term}" soa natural numa conversa clara.`,
  }),
  nl: sourceTemplates({
    daily: (term) => `Vandaag zet ik "${term}" op mijn lijst.`,
    question: (term) => `Wat betekent "${term}" in deze zin?`,
    negative: (term) => `Vertaal "${term}" niet zonder context.`,
    contextual: (term, tier) => `Op niveau ${tier} verschijnt "${term}" in een nieuwe context.`,
    natural: (term) => `"${term}" klinkt natuurlijk in een helder gesprek.`,
  }),
  pl: sourceTemplates({
    daily: (term) => `Dzisiaj dodaję "${term}" do listy.`,
    question: (term) => `Co znaczy "${term}" w tym zdaniu?`,
    negative: (term) => `Nie tłumacz "${term}" bez kontekstu.`,
    contextual: (term, tier) => `Na poziomie ${tier} "${term}" pojawia się w nowym kontekście.`,
    natural: (term) => `"${term}" brzmi naturalnie w rozmowie.`,
  }),
  ar: sourceTemplates({
    daily: (term) => `أضفت "${term}" إلى قائمة الدراسة اليوم.`,
    question: (term) => `ماذا تعني "${term}" في هذه الجملة؟`,
    negative: (term) => `لا تترجم "${term}" دون سياق.`,
    contextual: (term, tier) => `في مستوى ${tier} تظهر "${term}" في سياق جديد.`,
    natural: (term) => `تبدو "${term}" طبيعية في محادثة واضحة.`,
  }),
  ja: sourceTemplates({
    daily: (term) => `今日は「${term}」を学習リストに入れました。`,
    question: (term) => `この文で「${term}」は何を意味しますか。`,
    negative: (term) => `文脈なしで「${term}」を訳しません。`,
    contextual: (term, tier) => `${tier} レベルでは「${term}」が新しい文脈で出ます。`,
    natural: (term) => `会話では「${term}」が自然に使われます。`,
  }),
  ko: sourceTemplates({
    daily: (term) => `오늘 "${term}"을 학습 목록에 넣었습니다.`,
    question: (term) => `이 문장에서 "${term}"은 무슨 뜻인가요?`,
    negative: (term) => `문맥 없이 "${term}"을 번역하지 않습니다.`,
    contextual: (term, tier) => `${tier} 단계에서 "${term}"은 새로운 문맥에 나옵니다.`,
    natural: (term) => `대화에서 "${term}"은 자연스럽게 쓰입니다.`,
  }),
  "zh-CN": sourceTemplates({
    daily: (term) => `今天我把“${term}”加入学习列表。`,
    question: (term) => `“${term}”在这个句子里是什么意思？`,
    negative: (term) => `不要脱离语境翻译“${term}”。`,
    contextual: (term, tier) => `在 ${tier} 等级，“${term}”会出现在新语境中。`,
    natural: (term) => `在清晰的对话中，“${term}”很自然。`,
  }),
};

const TRANSLATED_EXAMPLE_TEMPLATES: Record<LocaleCode, ContextTemplates> = SOURCE_EXAMPLE_TEMPLATES;

function sourceTemplates(templates: ContextTemplates): ContextTemplates {
  return templates;
}

type GrammarBuilder = (term: string, tier: Tier, group: PartOfSpeechGroup) => GrammarGuide;

const GRAMMAR_BUILDERS: Record<LocaleCode, GrammarBuilder> = {
  tr: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" kartı ${tier} seviyesinde çalışılan ${group === "phrase" ? "sabit bir ifade" : "tek kelimelik bir terim"}dir.`,
    rules: [
      "Kelimeyi tek başına ezberlemek yerine örnek cümledeki görevine dikkat et.",
      "Çeviri eşleştirmesi aktif arayüz diline göre gösterilir.",
      "Tier yükseldikçe kartın öğrenildi sayılması için daha fazla doğru cevap gerekir.",
    ],
    details: [
      "Bu geniş katalog otomatik sözlük seed verisiyle üretildiği için özel çekim tabloları ileride kürasyon katmanında zenginleştirilebilir.",
    ],
  }),
  en: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" is a ${tier} ${group === "phrase" ? "fixed expression" : "single-word term"} card.`,
    rules: [
      "Read the word inside its example sentence instead of memorizing it alone.",
      "Translations follow the selected interface language.",
      "Higher tiers require more correct quiz answers before the card becomes learned.",
    ],
    details: [
      "This large catalog is generated from dictionary seed data; hand-curated conjugation tables can be layered on top later.",
    ],
  }),
  de: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" ist eine ${tier}-Karte für ${group === "phrase" ? "einen festen Ausdruck" : "ein einzelnes Wort"}.`,
    rules: ["Lies das Wort im Beispielsatz.", "Die Übersetzung folgt der UI-Sprache.", "Höhere Tiers brauchen mehr richtige Antworten."],
    details: ["Spezielle Deklinationen und Konjugationen können später kuratiert ergänzt werden."],
  }),
  ru: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `«${term}» — карточка уровня ${tier} для ${group === "phrase" ? "устойчивого выражения" : "одного слова"}.`,
    rules: ["Смотри на слово в примере.", "Перевод зависит от выбранного языка интерфейса.", "Более высокий tier требует больше правильных ответов."],
    details: ["Подробные таблицы склонения и спряжения можно добавить в curated-слой."],
  }),
  fr: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" est une carte ${tier} pour ${group === "phrase" ? "une expression fixe" : "un mot unique"}.`,
    rules: ["Lis le mot dans sa phrase.", "La traduction suit la langue de l'interface.", "Les tiers plus élevés exigent plus de bonnes réponses."],
    details: ["Les détails grammaticaux spécifiques peuvent être enrichis plus tard."],
  }),
  es: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" es una tarjeta ${tier} de ${group === "phrase" ? "expresión fija" : "una sola palabra"}.`,
    rules: ["Lee la palabra dentro del ejemplo.", "La traducción sigue el idioma de la interfaz.", "Los tiers altos requieren más respuestas correctas."],
    details: ["Las tablas gramaticales específicas se pueden añadir después."],
  }),
  it: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" è una carta ${tier} per ${group === "phrase" ? "un'espressione fissa" : "una parola singola"}.`,
    rules: ["Leggi la parola nella frase.", "La traduzione segue la lingua dell'interfaccia.", "I tier più alti richiedono più risposte corrette."],
    details: ["Le note grammaticali specifiche possono essere curate in seguito."],
  }),
  pt: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" é uma carta ${tier} de ${group === "phrase" ? "expressão fixa" : "palavra única"}.`,
    rules: ["Lê a palavra no exemplo.", "A tradução segue o idioma da interface.", "Tiers mais altos exigem mais respostas corretas."],
    details: ["Notas gramaticais específicas podem ser enriquecidas depois."],
  }),
  nl: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" is een ${tier}-kaart voor ${group === "phrase" ? "een vaste uitdrukking" : "een enkel woord"}.`,
    rules: ["Lees het woord in de voorbeeldzin.", "De vertaling volgt de interfacetaal.", "Hogere tiers vragen meer juiste antwoorden."],
    details: ["Specifieke grammatica kan later handmatig worden aangevuld."],
  }),
  pl: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" to karta ${tier} dla ${group === "phrase" ? "stałego wyrażenia" : "pojedynczego słowa"}.`,
    rules: ["Czytaj słowo w zdaniu przykładowym.", "Tłumaczenie zależy od języka interfejsu.", "Wyższe tiery wymagają więcej poprawnych odpowiedzi."],
    details: ["Szczegółową gramatykę można dodać później."],
  }),
  ar: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}" بطاقة مستوى ${tier} لـ${group === "phrase" ? "تعبير ثابت" : "كلمة مفردة"}.`,
    rules: ["اقرأ الكلمة داخل المثال.", "الترجمة تتبع لغة الواجهة.", "المستويات الأعلى تحتاج إجابات صحيحة أكثر."],
    details: ["يمكن إضافة جداول صرف مفصلة لاحقًا."],
  }),
  ja: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `「${term}」は${tier}レベルの${group === "phrase" ? "固定表現" : "単語"}カードです。`,
    rules: ["例文の中で確認します。", "翻訳はUI言語に合わせます。", "高い tier ほど多くの正解が必要です。"],
    details: ["詳しい活用表は後から追加できます。"],
  }),
  ko: (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `"${term}"은 ${tier} 단계의 ${group === "phrase" ? "고정 표현" : "단어"} 카드입니다.`,
    rules: ["예문 안에서 단어를 확인하세요.", "번역은 UI 언어를 따릅니다.", "높은 tier일수록 더 많은 정답이 필요합니다."],
    details: ["세부 문법표는 나중에 추가할 수 있습니다."],
  }),
  "zh-CN": (term, tier, group) => genericGrammar(term, tier, group, {
    summary: `“${term}”是 ${tier} 等级的${group === "phrase" ? "固定表达" : "单词"}卡。`,
    rules: ["在例句中理解这个词。", "翻译跟随界面语言。", "等级越高，需要的正确次数越多。"],
    details: ["更详细的语法表可以在人工校对层补充。"],
  }),
};

function genericGrammar(
  _term: string,
  _tier: Tier,
  _group: PartOfSpeechGroup,
  guide: Pick<GrammarGuide, "summary" | "rules" | "details">,
): GrammarGuide {
  return guide;
}

function encodeKeyPart(value: string) {
  return encodeURIComponent(value.normalize("NFC").toLocaleLowerCase("en"));
}

function stableIndex(value: string, size: number) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) % 2147483647;
  }

  return hash % size;
}

function emptyLanguageCount(): Record<LanguageCode, number> {
  return Object.fromEntries(LANGUAGE_CODES.map((language) => [language, 0])) as Record<LanguageCode, number>;
}

function emptyLanguageTierCount(): Record<LanguageCode, Record<Tier, number>> {
  return Object.fromEntries(LANGUAGE_CODES.map((language) => [language, emptyTierCount()])) as Record<
    LanguageCode,
    Record<Tier, number>
  >;
}

function emptyTierCount(): Record<Tier, number> {
  return Object.fromEntries(TIERS.map((tier) => [tier, 0])) as Record<Tier, number>;
}

export const VOCABULARY_CARDS: VocabularyCard[] = buildCatalog();
export const CATALOG_REPORT = getCatalogReport(VOCABULARY_CARDS);

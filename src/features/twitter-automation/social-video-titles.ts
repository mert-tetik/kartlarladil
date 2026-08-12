import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { getLanguageDisplayName } from "@/i18n/labels";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

export type SocialCaptionKind = "miniQuiz" | "falseFriends" | "dailyChallenge" | "vocabularyProgression" | "exampleSentences" | "vocabularyCarousel" | "tierProgression";
export type SocialVisualCaptionKind = SocialCaptionKind | "marketingDialogue" | "everydayDialogue" | "sentenceCheck" | "sentenceTranslation";

/**
 * Localized "Word of the Day" titles for social posters and thumbnails.
 * These are short, fixed phrases that should not require a round-trip to the
 * creative model every time a card image is rendered.
 */
export const WORD_OF_THE_DAY_TITLE: Record<LanguageCode, string> = {
  tr: "Günün Kelimesi",
  en: "Word of the Day",
  de: "Wort des Tages",
  ru: "Слово дня",
  fr: "Mot du Jour",
  es: "Palabra del Día",
  it: "Parola del Giorno",
  pt: "Palavra do Dia",
  nl: "Woord van de Dag",
  pl: "Słowo Dnia",
  ar: "كلمة اليوم",
  ja: "今日の単語",
  ko: "오늘의 단어",
  "zh-CN": "今日单词",
};

const NATIVE_CAPTION_HASHTAGS: Record<LanguageCode, readonly string[]> = {
  tr: ["#dilöğrenme", "#kelimeöğrenme", "#yabancıdil", "#dilpratiği", "#kelimehazinesi"],
  en: ["#languagelearning", "#vocabulary", "#languagepractice", "#learnalanguage", "#wordpower"],
  de: ["#sprachenlernen", "#wortschatz", "#fremdsprachen", "#sprachpraxis", "#wortlernen"],
  ru: ["#изучениеязыков", "#словарныйзапас", "#иностранныеязыки", "#языковаяпрактика", "#учимслова"],
  fr: ["#apprentissagedeslangues", "#vocabulaire", "#languesétrangères", "#pratiquedeslangues", "#apprendrelesmots"],
  es: ["#aprendizajedeidiomas", "#vocabulario", "#idiomas", "#prácticadeidiomas", "#aprendepalabras"],
  it: ["#apprendimentolingue", "#vocabolario", "#linguestraniere", "#praticadellingua", "#imparoleparole"],
  pt: ["#aprendizadodeidiomas", "#vocabulário", "#línguasestrangeiras", "#práticadeidiomas", "#aprendapalavras"],
  nl: ["#talenleren", "#woordenschat", "#vreemdetalen", "#taalvaardigheid", "#woordleren"],
  pl: ["#naukajezykow", "#slownictwo", "#jezykiobce", "#praktykajezykowa", "#naukaslow"],
  ar: ["#تعلماللغات", "#مفردات", "#لغاتأجنبية", "#ممارسةاللغة", "#تعلمالكلمات"],
  ja: ["#語学学習", "#単語", "#外国語", "#語学練習", "#単語学習"],
  ko: ["#언어학습", "#어휘", "#외국어", "#언어연습", "#단어공부"],
  "zh-CN": ["#语言学习", "#词汇", "#外语学习", "#语言练习", "#背单词"],
};

const NATIVE_VIDEO_CAPTION_HEADINGS: Record<LanguageCode, Record<"marketingDialogue" | "everydayDialogue" | "sentenceCheck" | "sentenceTranslation", string>> = {
  tr: { marketingDialogue: "FoxiesDeck Diyaloğu", everydayDialogue: "Günlük Diyalog", sentenceCheck: "Cümle Kontrolü", sentenceTranslation: "Rastgele Cümleler" },
  en: { marketingDialogue: "FoxiesDeck Dialogue", everydayDialogue: "Everyday Dialogue", sentenceCheck: "Sentence Check", sentenceTranslation: "Random Sentences" },
  de: { marketingDialogue: "FoxiesDeck-Dialog", everydayDialogue: "Alltagsdialog", sentenceCheck: "Satzcheck", sentenceTranslation: "Zufällige Sätze" },
  ru: { marketingDialogue: "Диалог FoxiesDeck", everydayDialogue: "Повседневный диалог", sentenceCheck: "Проверка предложений", sentenceTranslation: "Случайные предложения" },
  fr: { marketingDialogue: "Dialogue FoxiesDeck", everydayDialogue: "Dialogue du quotidien", sentenceCheck: "Vérification de phrases", sentenceTranslation: "Phrases aléatoires" },
  es: { marketingDialogue: "Diálogo de FoxiesDeck", everydayDialogue: "Diálogo cotidiano", sentenceCheck: "Comprobación de frases", sentenceTranslation: "Frases aleatorias" },
  it: { marketingDialogue: "Dialogo FoxiesDeck", everydayDialogue: "Dialogo quotidiano", sentenceCheck: "Controllo delle frasi", sentenceTranslation: "Frasi casuali" },
  pt: { marketingDialogue: "Diálogo FoxiesDeck", everydayDialogue: "Diálogo do dia a dia", sentenceCheck: "Verificação de frases", sentenceTranslation: "Frases aleatórias" },
  nl: { marketingDialogue: "FoxiesDeck-dialoog", everydayDialogue: "Alledaagse dialoog", sentenceCheck: "Zinnen controleren", sentenceTranslation: "Willekeurige zinnen" },
  pl: { marketingDialogue: "Dialog FoxiesDeck", everydayDialogue: "Codzienny dialog", sentenceCheck: "Sprawdzanie zdań", sentenceTranslation: "Losowe zdania" },
  ar: { marketingDialogue: "حوار FoxiesDeck", everydayDialogue: "حوار يومي", sentenceCheck: "فحص الجمل", sentenceTranslation: "جمل عشوائية" },
  ja: { marketingDialogue: "FoxiesDeckの会話", everydayDialogue: "日常会話", sentenceCheck: "文のチェック", sentenceTranslation: "ランダムな例文" },
  ko: { marketingDialogue: "FoxiesDeck 대화", everydayDialogue: "일상 대화", sentenceCheck: "문장 확인", sentenceTranslation: "무작위 문장" },
  "zh-CN": { marketingDialogue: "FoxiesDeck 对话", everydayDialogue: "日常对话", sentenceCheck: "句子检查", sentenceTranslation: "随机句子" },
};

const NATIVE_VISUAL_CAPTION_SUMMARIES: Record<LanguageCode, (learningLanguageName: string, itemCount?: number) => string> = {
  tr: (language, count) => count ? `${language} pratiği için ${count} kısa bölüm bu görselde seni bekliyor.` : `${language} pratiğine bu görselle devam et.`,
  en: (language, count) => count ? `This visual gives you ${count} short ways to practise ${language}.` : `Keep practising ${language} with this visual.`,
  de: (language, count) => count ? `Dieser Beitrag bietet dir ${count} kurze Übungen für ${language}.` : `Übe ${language} mit diesem Beitrag weiter.`,
  ru: (language, count) => count ? `В этом материале — ${count} коротких заданий для практики ${language}.` : `Продолжай практиковать ${language} с этим материалом.`,
  fr: (language, count) => count ? `Ce visuel propose ${count} courtes activités pour pratiquer le ${language}.` : `Continue à pratiquer le ${language} avec ce visuel.`,
  es: (language, count) => count ? `Este visual propone ${count} momentos breves para practicar ${language}.` : `Sigue practicando ${language} con este visual.`,
  it: (language, count) => count ? `Questo contenuto propone ${count} brevi momenti per esercitarti in ${language}.` : `Continua a esercitarti in ${language} con questo contenuto.`,
  pt: (language, count) => count ? `Este visual traz ${count} momentos curtos para praticar ${language}.` : `Continue praticando ${language} com este visual.`,
  nl: (language, count) => count ? `Deze visual biedt ${count} korte oefenmomenten voor ${language}.` : `Blijf ${language} oefenen met deze visual.`,
  pl: (language, count) => count ? `Ten materiał zawiera ${count} krótkie ćwiczenia z języka ${language}.` : `Ćwicz dalej język ${language} z tym materiałem.`,
  ar: (language, count) => count ? `يحتوي هذا المحتوى على ${count} فقرات قصيرة للتدرب على ${language}.` : `تابع التدريب على ${language} مع هذا المحتوى.`,
  ja: (language, count) => count ? `このビジュアルには、${language}を練習するための短いパートが${count}つあります。` : `このビジュアルで${language}の練習を続けましょう。`,
  ko: (language, count) => count ? `이 콘텐츠에는 ${language} 연습을 위한 짧은 파트가 ${count}개 있어요.` : `이 콘텐츠로 ${language} 연습을 이어 가세요.`,
  "zh-CN": (language, count) => count ? `这张图片包含 ${count} 个简短的${language}练习内容。` : `用这张图片继续练习${language}吧。`,
};

const RUSSIAN_CAPTION_LANGUAGE_FORMS: Record<LanguageCode, { accusative: string; genitive: string }> = {
  tr: { accusative: "\u0442\u0443\u0440\u0435\u0446\u043a\u0438\u0439", genitive: "\u0442\u0443\u0440\u0435\u0446\u043a\u043e\u0433\u043e" },
  en: { accusative: "\u0430\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439", genitive: "\u0430\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u043e\u0433\u043e" },
  de: { accusative: "\u043d\u0435\u043c\u0435\u0446\u043a\u0438\u0439", genitive: "\u043d\u0435\u043c\u0435\u0446\u043a\u043e\u0433\u043e" },
  ru: { accusative: "\u0440\u0443\u0441\u0441\u043a\u0438\u0439", genitive: "\u0440\u0443\u0441\u0441\u043a\u043e\u0433\u043e" },
  fr: { accusative: "\u0444\u0440\u0430\u043d\u0446\u0443\u0437\u0441\u043a\u0438\u0439", genitive: "\u0444\u0440\u0430\u043d\u0446\u0443\u0437\u0441\u043a\u043e\u0433\u043e" },
  es: { accusative: "\u0438\u0441\u043f\u0430\u043d\u0441\u043a\u0438\u0439", genitive: "\u0438\u0441\u043f\u0430\u043d\u0441\u043a\u043e\u0433\u043e" },
  it: { accusative: "\u0438\u0442\u0430\u043b\u044c\u044f\u043d\u0441\u043a\u0438\u0439", genitive: "\u0438\u0442\u0430\u043b\u044c\u044f\u043d\u0441\u043a\u043e\u0433\u043e" },
  pt: { accusative: "\u043f\u043e\u0440\u0442\u0443\u0433\u0430\u043b\u044c\u0441\u043a\u0438\u0439", genitive: "\u043f\u043e\u0440\u0442\u0443\u0433\u0430\u043b\u044c\u0441\u043a\u043e\u0433\u043e" },
  nl: { accusative: "\u043d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u0441\u043a\u0438\u0439", genitive: "\u043d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u0441\u043a\u043e\u0433\u043e" },
  pl: { accusative: "\u043f\u043e\u043b\u044c\u0441\u043a\u0438\u0439", genitive: "\u043f\u043e\u043b\u044c\u0441\u043a\u043e\u0433\u043e" },
  ar: { accusative: "\u0430\u0440\u0430\u0431\u0441\u043a\u0438\u0439", genitive: "\u0430\u0440\u0430\u0431\u0441\u043a\u043e\u0433\u043e" },
  ja: { accusative: "\u044f\u043f\u043e\u043d\u0441\u043a\u0438\u0439", genitive: "\u044f\u043f\u043e\u043d\u0441\u043a\u043e\u0433\u043e" },
  ko: { accusative: "\u043a\u043e\u0440\u0435\u0439\u0441\u043a\u0438\u0439", genitive: "\u043a\u043e\u0440\u0435\u0439\u0441\u043a\u043e\u0433\u043e" },
  "zh-CN": { accusative: "\u043a\u0438\u0442\u0430\u0439\u0441\u043a\u0438\u0439", genitive: "\u043a\u0438\u0442\u0430\u0439\u0441\u043a\u043e\u0433\u043e" },
};

function getRussianShortTaskLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0445 \u0437\u0430\u0434\u0430\u043d\u0438\u0439";
  if (lastDigit === 1) return "\u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u0437\u0430\u0434\u0430\u043d\u0438\u0435";
  if (lastDigit >= 2 && lastDigit <= 4) return "\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0445 \u0437\u0430\u0434\u0430\u043d\u0438\u044f";
  return "\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0445 \u0437\u0430\u0434\u0430\u043d\u0438\u0439";
}

function getNativeVisualCaptionSummary(nativeLanguage: LanguageCode, learningLanguage: LanguageCode, itemCount?: number) {
  if (nativeLanguage !== "ru") {
    return NATIVE_VISUAL_CAPTION_SUMMARIES[nativeLanguage](getLanguageDisplayName(learningLanguage, nativeLanguage), itemCount);
  }

  const language = RUSSIAN_CAPTION_LANGUAGE_FORMS[learningLanguage];
  return itemCount === undefined
    ? `\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0439 \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u043e\u0432\u0430\u0442\u044c ${language.accusative} \u0441 \u044d\u0442\u0438\u043c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u043c.`
    : `\u0412 \u044d\u0442\u043e\u043c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0435 \u2014 ${itemCount} ${getRussianShortTaskLabel(itemCount)} \u0434\u043b\u044f \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0438 ${language.genitive}.`;
}

const NATIVE_CAPTION_HEADINGS: Record<LanguageCode, Record<SocialCaptionKind, string>> = {
  tr: { miniQuiz: "Mini Quiz", falseFriends: "Aynı Anlamda Farklı Kelimeler", dailyChallenge: "Günün Meydan Okuması", vocabularyProgression: "Kelime Gelişimi", exampleSentences: "Örnek Cümleler", vocabularyCarousel: "Bugünün Kelimeleri", tierProgression: "A1'den C1'e Kelimeler" },
  en: { miniQuiz: "Mini Quiz", falseFriends: "Different Words, Same Meaning", dailyChallenge: "Daily Challenge", vocabularyProgression: "Vocabulary Progression", exampleSentences: "Example Sentences", vocabularyCarousel: "Today's Words", tierProgression: "Words from A1 to C1" },
  de: { miniQuiz: "Mini-Quiz", falseFriends: "Verschiedene Wörter, gleiche Bedeutung", dailyChallenge: "Tages-Challenge", vocabularyProgression: "Wortschatz-Fortschritt", exampleSentences: "Beispielsätze", vocabularyCarousel: "Wörter für heute", tierProgression: "Wörter von A1 bis C1" },
  ru: { miniQuiz: "Мини-викторина", falseFriends: "Разные слова, один смысл", dailyChallenge: "Задание дня", vocabularyProgression: "Развитие словарного запаса", exampleSentences: "Примеры предложений", vocabularyCarousel: "Слова на сегодня", tierProgression: "Слова от A1 до C1" },
  fr: { miniQuiz: "Mini quiz", falseFriends: "Des mots différents, même sens", dailyChallenge: "Défi du jour", vocabularyProgression: "Progression du vocabulaire", exampleSentences: "Phrases d'exemple", vocabularyCarousel: "Les mots du jour", tierProgression: "Des mots de A1 à C1" },
  es: { miniQuiz: "Mini cuestionario", falseFriends: "Palabras distintas, mismo significado", dailyChallenge: "Reto del día", vocabularyProgression: "Progreso de vocabulario", exampleSentences: "Frases de ejemplo", vocabularyCarousel: "Palabras de hoy", tierProgression: "Palabras de A1 a C1" },
  it: { miniQuiz: "Mini quiz", falseFriends: "Parole diverse, stesso significato", dailyChallenge: "Sfida del giorno", vocabularyProgression: "Progresso del vocabolario", exampleSentences: "Frasi di esempio", vocabularyCarousel: "Parole di oggi", tierProgression: "Parole da A1 a C1" },
  pt: { miniQuiz: "Mini quiz", falseFriends: "Palavras diferentes, mesmo significado", dailyChallenge: "Desafio do dia", vocabularyProgression: "Progresso de vocabulário", exampleSentences: "Frases de exemplo", vocabularyCarousel: "Palavras de hoje", tierProgression: "Palavras de A1 a C1" },
  nl: { miniQuiz: "Miniquiz", falseFriends: "Verschillende woorden, dezelfde betekenis", dailyChallenge: "Uitdaging van de dag", vocabularyProgression: "Woordenschatgroei", exampleSentences: "Voorbeeldzinnen", vocabularyCarousel: "Woorden van vandaag", tierProgression: "Woorden van A1 tot C1" },
  pl: { miniQuiz: "Mini quiz", falseFriends: "Różne słowa, to samo znaczenie", dailyChallenge: "Wyzwanie dnia", vocabularyProgression: "Rozwój słownictwa", exampleSentences: "Przykładowe zdania", vocabularyCarousel: "Dzisiejsze słowa", tierProgression: "Słowa od A1 do C1" },
  ar: { miniQuiz: "اختبار قصير", falseFriends: "كلمات مختلفة، المعنى نفسه", dailyChallenge: "تحدي اليوم", vocabularyProgression: "تطور المفردات", exampleSentences: "جمل نموذجية", vocabularyCarousel: "كلمات اليوم", tierProgression: "كلمات من A1 إلى C1" },
  ja: { miniQuiz: "ミニクイズ", falseFriends: "違う言葉、同じ意味", dailyChallenge: "今日のチャレンジ", vocabularyProgression: "語彙のステップアップ", exampleSentences: "例文", vocabularyCarousel: "今日の単語", tierProgression: "A1からC1の単語" },
  ko: { miniQuiz: "미니 퀴즈", falseFriends: "다른 단어, 같은 뜻", dailyChallenge: "오늘의 도전", vocabularyProgression: "어휘 성장", exampleSentences: "예문", vocabularyCarousel: "오늘의 단어", tierProgression: "A1부터 C1까지의 단어" },
  "zh-CN": { miniQuiz: "迷你测验", falseFriends: "不同的词，同样的意思", dailyChallenge: "今日挑战", vocabularyProgression: "词汇进阶", exampleSentences: "例句", vocabularyCarousel: "今日词汇", tierProgression: "从 A1 到 C1 的词汇" },
};

const VOCABULARY_PROGRESSION_HEADINGS: Record<LanguageCode, string> = {
  tr: "Ayn\u0131 Kelimenin 3 Seviyesi",
  en: "One Word, Three Levels",
  de: "Ein Wort, drei Niveaus",
  ru: "\u041E\u0434\u043D\u043E \u0441\u043B\u043E\u0432\u043E, \u0442\u0440\u0438 \u0443\u0440\u043E\u0432\u043D\u044F",
  fr: "Un mot, trois niveaux",
  es: "Una palabra, tres niveles",
  it: "Una parola, tre livelli",
  pt: "Uma palavra, tr\u00EAs n\u00EDveis",
  nl: "E\u00E9n woord, drie niveaus",
  pl: "Jedno s\u0142owo, trzy poziomy",
  ar: "\u0643\u0644\u0645\u0629 \u0648\u0627\u062D\u062F\u0629\u060C \u062B\u0644\u0627\u062B\u0629 \u0645\u0633\u062A\u0648\u064A\u0627\u062A",
  ja: "\u0031\u3064\u306E\u5358\u8A9E\u3001\u0033\u3064\u306E\u30EC\u30D9\u30EB",
  ko: "\uD558\uB098\uC758 \uB2E8\uC5B4, \uC138 \uB2E8\uACC4",
  "zh-CN": "\u4E00\u4E2A\u5355\u8BCD\uFF0C\u4E09\u4E2A\u7EA7\u522B",
};

export function getWordOfTheDayTitle(language: LanguageCode) {
  return WORD_OF_THE_DAY_TITLE[language];
}

export function getNativeCaptionHashtags(language: LanguageCode) {
  return NATIVE_CAPTION_HASHTAGS[language];
}

export function getNativeCaptionHeading(language: LanguageCode, kind: SocialCaptionKind) {
  if (kind === "vocabularyProgression") {
    return VOCABULARY_PROGRESSION_HEADINGS[language];
  }

  return NATIVE_CAPTION_HEADINGS[language][kind];
}

export function createNativeVisualCaption({
  kind,
  learningLanguage,
  nativeLanguage,
  itemCount,
}: {
  kind: SocialVisualCaptionKind;
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  itemCount?: number;
}) {
  const heading = kind === "marketingDialogue" || kind === "everydayDialogue" || kind === "sentenceCheck" || kind === "sentenceTranslation"
    ? NATIVE_VIDEO_CAPTION_HEADINGS[nativeLanguage][kind]
    : getNativeCaptionHeading(nativeLanguage, kind);
  const summary = getNativeVisualCaptionSummary(nativeLanguage, learningLanguage, itemCount);
  return finalizeNativeCaption([heading, summary].join("\n\n"), nativeLanguage);
}

export function finalizeNativeCaption(caption: string, nativeLanguage: LanguageCode) {
  const nativeHashtags = NATIVE_CAPTION_HASHTAGS[nativeLanguage].join(" ");
  const captionWithoutHashtags = caption
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return [captionWithoutHashtags, nativeHashtags].filter(Boolean).join("\n\n");
}

export function createWordOfTheDayCaption(card: VocabularyCard, nativeLanguage: LanguageCode) {
  const meaning = getPrimaryCardTranslation(card, nativeLanguage);
  const example = card.examples[0]?.sentence ?? card.example;
  return finalizeNativeCaption([getWordOfTheDayTitle(nativeLanguage), `${card.term} — ${meaning}`, example].filter(Boolean).join("\n"), nativeLanguage);
}

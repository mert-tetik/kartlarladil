import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

export type SocialCaptionKind = "miniQuiz" | "falseFriends" | "dailyChallenge" | "vocabularyProgression" | "exampleSentences" | "vocabularyCarousel" | "tierProgression";

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
  tr: ["#dilöğrenme", "#kelimeöğrenme", "#gününkelimesi"],
  en: ["#languagelearning", "#vocabulary", "#wordoftheday"],
  de: ["#sprachenlernen", "#wortschatz", "#wortdestages"],
  ru: ["#изучениеязыков", "#словарныйзапас", "#словодня"],
  fr: ["#apprentissagedeslangues", "#vocabulaire", "#motdujour"],
  es: ["#aprendizajedeidiomas", "#vocabulario", "#palabradeldía"],
  it: ["#apprendimentolingue", "#vocabolario", "#paroladelgiorno"],
  pt: ["#aprendizadodeidiomas", "#vocabulário", "#palavradodia"],
  nl: ["#talenleren", "#woordenschat", "#woordvandedag"],
  pl: ["#naukajezykow", "#slownictwo", "#slowodnia"],
  ar: ["#تعلماللغات", "#مفردات", "#كلمةاليوم"],
  ja: ["#語学学習", "#単語", "#今日の単語"],
  ko: ["#언어학습", "#어휘", "#오늘의단어"],
  "zh-CN": ["#语言学习", "#词汇", "#每日一词"],
};

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

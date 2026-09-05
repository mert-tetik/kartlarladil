import { z } from "zod";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  CARD_GROUPS,
  CARD_GROUP_IMAGE_PATHS,
  getCardsForGroup,
  type CardGroupIcon,
} from "@/features/cards/card-groups";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import type { LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";
export { BONUS_QUESTION_POINTS, getBonusQuestionPoints } from "@/features/quiz/bonus-question-constants";
export type { BonusQuestionKind } from "@/features/quiz/bonus-question-constants";

export interface BonusPair {
  id: string;
  cardId: string;
  term: string;
  meaning: string;
}

export interface MatchingBonusQuestion {
  kind: "matching";
  pairs: BonusPair[];
  terms: BonusPair[];
  meanings: BonusPair[];
}

export interface SentenceOrderToken {
  id: string;
  text: string;
}

export interface SentenceOrderBonusQuestion {
  kind: "sentence-order";
  sentence: string;
  tokens: SentenceOrderToken[];
  sourceCardId: string;
}

export interface CategoryWord {
  id: string;
  cardId: string;
  text: string;
}

export interface BonusCategory {
  id: string;
  name: string;
  nameKey?: CardGroupIcon;
  wordIds: string[];
}

export interface CategorySortBonusQuestion {
  kind: "category-sort";
  categories: BonusCategory[];
  words: CategoryWord[];
}

export interface ImposterOption {
  id: string;
  cardId: string;
  text: string;
  isImposter: boolean;
}

export interface ImposterBonusQuestion {
  kind: "imposter";
  groupId: CardGroupIcon;
  groupImageSrc: string;
  options: ImposterOption[];
  correctOptionId: string;
}

export type BonusQuestion =
  | MatchingBonusQuestion
  | SentenceOrderBonusQuestion
  | CategorySortBonusQuestion
  | ImposterBonusQuestion;

export const generatedSentenceBonusSchema = z.object({
  sentence: z.string().trim().min(2).max(180),
  tokens: z.array(z.string().trim().min(1).max(40)).min(2).max(14),
  sourceCardId: z.string().trim().min(1).max(160),
});

export const generatedCategoryBonusSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string().trim().min(1).max(60),
      cardIds: z.array(z.string().trim().min(1).max(160)).length(3),
    }),
  ).length(3),
});

export type GeneratedSentenceBonus = z.infer<typeof generatedSentenceBonusSchema>;
export type GeneratedCategoryBonus = z.infer<typeof generatedCategoryBonusSchema>;

export const BONUS_COPY: Record<LocaleCode, {
  intro: string;
  matchingTitle: string;
  matchingPrompt: string;
  sentenceTitle: string;
  sentencePrompt: string;
  categoryTitle: string;
  categoryPrompt: string;
  imposterTitle: string;
  imposterPrompt: string;
  check: string;
  correct: string;
  incorrect: string;
  bonusPoints: string;
}> = {
  tr: { intro: "BONUS SORU", matchingTitle: "Eşleştir", matchingPrompt: "Kelimeyi doğru anlamıyla eşleştir", sentenceTitle: "Cümleyi kur", sentencePrompt: "Kelimeleri doğru sıraya diz", categoryTitle: "Kategorilere ayır", categoryPrompt: "Kelimeleri doğru gruba yerleştir", imposterTitle: "Farklı olanı bul", imposterPrompt: "Bu gruba ait olmayan kelimeyi seç", check: "Kontrol et", correct: "Doğru bildin!", incorrect: "Bu kez olmadı.", bonusPoints: "Bonus puan" },
  en: { intro: "BONUS QUESTION", matchingTitle: "Match them", matchingPrompt: "Match each word with its meaning", sentenceTitle: "Build the sentence", sentencePrompt: "Put the words in the right order", categoryTitle: "Sort the categories", categoryPrompt: "Place each word in the right group", imposterTitle: "Find the odd one", imposterPrompt: "Choose the word that does not belong", check: "Check", correct: "You got it!", incorrect: "Not this time.", bonusPoints: "Bonus points" },
  de: { intro: "BONUSFRAGE", matchingTitle: "Ordne zu", matchingPrompt: "Ordne jedes Wort seiner Bedeutung zu", sentenceTitle: "Bilde den Satz", sentencePrompt: "Bringe die Wörter in die richtige Reihenfolge", categoryTitle: "Sortiere die Kategorien", categoryPrompt: "Ordne jedes Wort der richtigen Gruppe zu", imposterTitle: "Finde den Außenseiter", imposterPrompt: "Wähle das Wort, das nicht dazugehört", check: "Prüfen", correct: "Richtig!", incorrect: "Diesmal nicht.", bonusPoints: "Bonuspunkte" },
  ru: { intro: "БОНУСНЫЙ ВОПРОС", matchingTitle: "Сопоставь", matchingPrompt: "Соедини слово с его значением", sentenceTitle: "Составь предложение", sentencePrompt: "Расставь слова в правильном порядке", categoryTitle: "Распредели по категориям", categoryPrompt: "Помести каждое слово в нужную группу", imposterTitle: "Найди лишнее", imposterPrompt: "Выбери слово, которое не подходит", check: "Проверить", correct: "Правильно!", incorrect: "Не в этот раз.", bonusPoints: "Бонусные очки" },
  fr: { intro: "QUESTION BONUS", matchingTitle: "Associe-les", matchingPrompt: "Associe chaque mot à sa définition", sentenceTitle: "Construis la phrase", sentencePrompt: "Mets les mots dans le bon ordre", categoryTitle: "Trie les catégories", categoryPrompt: "Place chaque mot dans le bon groupe", imposterTitle: "Trouve l'intrus", imposterPrompt: "Choisis le mot qui n'appartient pas au groupe", check: "Vérifier", correct: "Bonne réponse !", incorrect: "Pas cette fois.", bonusPoints: "Points bonus" },
  es: { intro: "PREGUNTA EXTRA", matchingTitle: "Relaciona", matchingPrompt: "Relaciona cada palabra con su significado", sentenceTitle: "Forma la frase", sentencePrompt: "Ordena las palabras correctamente", categoryTitle: "Ordena las categorías", categoryPrompt: "Coloca cada palabra en el grupo correcto", imposterTitle: "Encuentra la intrusa", imposterPrompt: "Elige la palabra que no pertenece", check: "Comprobar", correct: "¡Correcto!", incorrect: "Esta vez no.", bonusPoints: "Puntos extra" },
  it: { intro: "DOMANDA BONUS", matchingTitle: "Abbina", matchingPrompt: "Abbina ogni parola al suo significato", sentenceTitle: "Costruisci la frase", sentencePrompt: "Metti le parole nell'ordine corretto", categoryTitle: "Dividi per categorie", categoryPrompt: "Metti ogni parola nel gruppo corretto", imposterTitle: "Trova l'intruso", imposterPrompt: "Scegli la parola che non appartiene", check: "Controlla", correct: "Risposta corretta!", incorrect: "Non questa volta.", bonusPoints: "Punti bonus" },
  pt: { intro: "PERGUNTA BÔNUS", matchingTitle: "Combine", matchingPrompt: "Combine cada palavra com seu significado", sentenceTitle: "Monte a frase", sentencePrompt: "Coloque as palavras na ordem certa", categoryTitle: "Separe as categorias", categoryPrompt: "Coloque cada palavra no grupo certo", imposterTitle: "Encontre a diferente", imposterPrompt: "Escolha a palavra que não pertence", check: "Conferir", correct: "Você acertou!", incorrect: "Desta vez não.", bonusPoints: "Pontos bônus" },
  nl: { intro: "BONUSVRAAG", matchingTitle: "Koppel ze", matchingPrompt: "Koppel elk woord aan de betekenis", sentenceTitle: "Bouw de zin", sentencePrompt: "Zet de woorden in de juiste volgorde", categoryTitle: "Sorteer de categorieën", categoryPrompt: "Plaats elk woord in de juiste groep", imposterTitle: "Vind de vreemde", imposterPrompt: "Kies het woord dat er niet bij hoort", check: "Controleren", correct: "Goed gedaan!", incorrect: "Deze keer niet.", bonusPoints: "Bonuspunten" },
  pl: { intro: "PYTANIE BONUSOWE", matchingTitle: "Dopasuj", matchingPrompt: "Dopasuj każde słowo do znaczenia", sentenceTitle: "Ułóż zdanie", sentencePrompt: "Ułóż słowa we właściwej kolejności", categoryTitle: "Sortuj kategorie", categoryPrompt: "Umieść każde słowo w odpowiedniej grupie", imposterTitle: "Znajdź intruza", imposterPrompt: "Wybierz słowo, które nie pasuje", check: "Sprawdź", correct: "Dobrze!", incorrect: "Tym razem nie.", bonusPoints: "Punkty bonusowe" },
  ar: { intro: "سؤال إضافي", matchingTitle: "طابقها", matchingPrompt: "طابق كل كلمة مع معناها", sentenceTitle: "كوّن الجملة", sentencePrompt: "رتب الكلمات بالترتيب الصحيح", categoryTitle: "رتب الفئات", categoryPrompt: "ضع كل كلمة في المجموعة الصحيحة", imposterTitle: "اعثر على الدخيل", imposterPrompt: "اختر الكلمة التي لا تنتمي", check: "تحقق", correct: "إجابة صحيحة!", incorrect: "ليس هذه المرة.", bonusPoints: "نقاط إضافية" },
  ja: { intro: "ボーナス問題", matchingTitle: "組み合わせ", matchingPrompt: "単語と意味を組み合わせてください", sentenceTitle: "文を作る", sentencePrompt: "単語を正しい順番に並べてください", categoryTitle: "カテゴリー分け", categoryPrompt: "単語を正しいグループに入れてください", imposterTitle: "仲間外れを探す", imposterPrompt: "グループに属さない単語を選んでください", check: "確認", correct: "正解です！", incorrect: "今回は違います。", bonusPoints: "ボーナスポイント" },
  ko: { intro: "보너스 문제", matchingTitle: "짝 맞추기", matchingPrompt: "각 단어를 뜻과 연결하세요", sentenceTitle: "문장 만들기", sentencePrompt: "단어를 올바른 순서로 배열하세요", categoryTitle: "범주별로 나누기", categoryPrompt: "각 단어를 알맞은 그룹에 넣으세요", imposterTitle: "다른 단어 찾기", imposterPrompt: "그룹에 속하지 않는 단어를 고르세요", check: "확인", correct: "정답이에요!", incorrect: "이번에는 아니에요.", bonusPoints: "보너스 포인트" },
  "zh-CN": { intro: "奖励题", matchingTitle: "配对", matchingPrompt: "将每个单词与其含义配对", sentenceTitle: "组成句子", sentencePrompt: "按正确顺序排列单词", categoryTitle: "分类", categoryPrompt: "将每个单词放入正确的类别", imposterTitle: "找出不同的词", imposterPrompt: "选择不属于该组的单词", check: "检查", correct: "答对了！", incorrect: "这次不对。", bonusPoints: "奖励积分" },
};

export function getBonusCopy(locale: LocaleCode) {
  return BONUS_COPY[locale] ?? BONUS_COPY.en;
}

export function buildMatchingBonusQuestion(
  cards: VocabularyCard[],
  uiLocale: LocaleCode,
  seed: string,
): MatchingBonusQuestion | null {
  const candidates = shuffle([...cards]).filter((card, index, all) => {
    const meaning = getPrimaryCardTranslation(card, uiLocale).trim();
    return Boolean(meaning) && all.findIndex((other) => other.id === card.id) === index;
  });

  if (candidates.length < 4) return null;

  const pairs = candidates.slice(0, 4).map((card, index) => ({
    id: `${seed}-pair-${index}`,
    cardId: card.id,
    term: card.term,
    meaning: getPrimaryCardTranslation(card, uiLocale),
  }));

  return {
    kind: "matching",
    pairs,
    terms: shuffle(pairs),
    meanings: shuffle(pairs),
  };
}

export function buildFallbackSentenceOrderQuestion(
  cards: VocabularyCard[],
  seed: string,
): SentenceOrderBonusQuestion | null {
  const candidates = shuffle(cards).flatMap((card) =>
    card.examples
      .map((example) => ({ card, sentence: example.sentence.trim() }))
      .filter(({ sentence }) => sentence.split(/\s+/u).length >= 2),
  );
  const candidate = candidates[0];

  if (!candidate) return null;

  const tokens = candidate.sentence.split(/\s+/u).map((text, index) => ({
    id: `${seed}-token-${index}`,
    text,
  }));

  return {
    kind: "sentence-order",
    sentence: candidate.sentence,
    tokens,
    sourceCardId: candidate.card.id,
  };
}

export function buildFallbackCategoryBonusQuestion(
  language: LanguageCode,
  seed: string,
): CategorySortBonusQuestion | null {
  const usedCardIds = new Set<string>();
  const categories: BonusCategory[] = [];
  const words: CategoryWord[] = [];

  for (const group of shuffle([...CARD_GROUPS])) {
    const groupCards = getCardsForGroup(group.id, language).filter((card) => !usedCardIds.has(card.id));
    if (groupCards.length < 3) continue;

    const selected = groupCards.slice(0, 3);
    const categoryWordIds = selected.map((card, index) => {
      usedCardIds.add(card.id);
      const id = `${seed}-category-${categories.length}-word-${index}`;
      words.push({ id, cardId: card.id, text: card.term });
      return id;
    });

    categories.push({
      id: `${seed}-category-${categories.length}`,
      name: group.id,
      nameKey: group.id,
      wordIds: categoryWordIds,
    });

    if (categories.length === 3) break;
  }

  if (categories.length !== 3) return null;

  return {
    kind: "category-sort",
    categories,
    words: shuffle(words),
  };
}

export function buildImposterBonusQuestion(
  language: LanguageCode,
  seed: string,
): ImposterBonusQuestion | null {
  const group = CARD_GROUPS.find((candidate) => getCardsForGroup(candidate.id, language).length >= 4);
  if (!group) return null;

  const groupCards = shuffle(getCardsForGroup(group.id, language)).slice(0, 4);
  const groupKeys = new Set(group.englishKeys.map((key) => key.toLowerCase()));
  const outsider = shuffle(VOCABULARY_CARDS).find(
    (card) => card.language === language && !groupKeys.has(card.englishKey.toLowerCase()),
  );

  if (!outsider) return null;

  const options = shuffle([
    ...groupCards.map((card, index) => ({
      id: `${seed}-imposter-${index}`,
      cardId: card.id,
      text: card.term,
      isImposter: false,
    })),
    {
      id: `${seed}-imposter-outlier`,
      cardId: outsider.id,
      text: outsider.term,
      isImposter: true,
    },
  ]);

  return {
    kind: "imposter",
    groupId: group.id,
    groupImageSrc: CARD_GROUP_IMAGE_PATHS[group.id],
    options,
    correctOptionId: options.find((option) => option.isImposter)!.id,
  };
}

export function buildSentenceBonusFromGenerated(
  generated: GeneratedSentenceBonus,
  cards: VocabularyCard[],
  seed: string,
): SentenceOrderBonusQuestion | null {
  const sourceCard = cards.find((card) => card.id === generated.sourceCardId);
  if (!sourceCard || generated.tokens.length < 2) return null;

  const normalizeSentence = (value: string) =>
    value
      .trim()
      .replace(/\s+([,.;!?])/gu, "$1")
      .replace(/\s+/gu, "")
      .toLocaleLowerCase();
  const tokenSentence = generated.tokens.join(" ");
  if (normalizeSentence(tokenSentence) !== normalizeSentence(generated.sentence)) {
    return null;
  }

  const tokens = generated.tokens.map((text, index) => ({
    id: `${seed}-token-${index}`,
    text,
  }));

  return {
    kind: "sentence-order",
    sentence: generated.sentence,
    tokens,
    sourceCardId: sourceCard.id,
  };
}

export function buildCategoryBonusFromGenerated(
  generated: GeneratedCategoryBonus,
  cards: VocabularyCard[],
  seed: string,
): CategorySortBonusQuestion | null {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const used = new Set<string>();
  const words: CategoryWord[] = [];
  const categories = generated.categories.map((category, categoryIndex) => {
    const wordIds = category.cardIds.map((cardId, wordIndex) => {
      const card = cardById.get(cardId);
      if (!card || used.has(card.id)) return null;
      used.add(card.id);
      const id = `${seed}-category-${categoryIndex}-word-${wordIndex}`;
      words.push({ id, cardId: card.id, text: card.term });
      return id;
    });

    if (wordIds.some((id): id is null => id === null)) return null;

    return {
      id: `${seed}-category-${categoryIndex}`,
      name: category.name,
      wordIds: wordIds as string[],
    };
  });

  if (categories.some((category) => category === null)) return null;

  return {
    kind: "category-sort",
    categories: categories as BonusCategory[],
    words: shuffle(words),
  };
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

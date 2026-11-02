import type {
  AiPracticeCharacter,
  DefinitionQuizQuestion,
  InventoryCard,
  ListeningQuizQuestion,
  QuizQuestion,
  SentenceCompletionQuizQuestion,
  TrueFalseQuizQuestion,
  VocabularyCard,
} from "@/types/domain";
import type { GroupQuestion } from "@/features/quiz/group-question";
import type { BonusQuestion, BonusQuestionKind } from "@/features/quiz/bonus-questions";

interface BaseQuizItem {
  card: VocabularyCard;
  inventoryCard: InventoryCard;
  willLearn: boolean;
  forceLearned?: boolean;
  isBonus?: false;
}

export interface ChoiceQuizItem extends BaseQuizItem {
  questionType: "choice";
  question: QuizQuestion;
}

export interface ListeningQuizItem extends BaseQuizItem {
  questionType: "listening";
  question: ListeningQuizQuestion;
}

export interface DefinitionQuizItem extends BaseQuizItem {
  questionType: "definition";
  question: DefinitionQuizQuestion;
}

export interface TextQuizItem extends BaseQuizItem {
  questionType: "text";
  question: { correctAnswer: string };
}

export interface TrueFalseQuizItem extends BaseQuizItem {
  questionType: "true-false";
  question: TrueFalseQuizQuestion;
}

export interface SentenceCompletionQuizItem extends BaseQuizItem {
  questionType: "sentence-completion";
  question: SentenceCompletionQuizQuestion;
  character: AiPracticeCharacter;
}

export interface GroupQuizItem extends BaseQuizItem {
  questionType: "group";
  question: GroupQuestion;
  character: AiPracticeCharacter;
}

export interface BonusQuizItem extends Omit<BaseQuizItem, "isBonus"> {
  isBonus: true;
  bonusId: string;
  questionType: `bonus-${BonusQuestionKind}`;
  bonusQuestion: BonusQuestion;
}

export type QuizItem =
  | ChoiceQuizItem
  | ListeningQuizItem
  | DefinitionQuizItem
  | TextQuizItem
  | TrueFalseQuizItem
  | SentenceCompletionQuizItem
  | GroupQuizItem
  | BonusQuizItem;

export type NormalQuizItem = Exclude<QuizItem, BonusQuizItem>;

export type PreparedBonusPlan = {
  index: number;
  kind: BonusQuestionKind;
  fallback: BonusQuestion | null;
  selectedForMaxDeck: boolean;
};

export type PreparedQuizPool = {
  key: string;
  regularItems: QuizItem[];
  bonusCards: VocabularyCard[];
  bonusLearnedCards: VocabularyCard[];
  bonusPlans: PreparedBonusPlan[];
  totalCandidateCount: number;
  metadataReady: boolean;
  complete: boolean;
};

export type QuizPoolProgressUpdate = {
  totalCandidateCount: number;
  regularItems: QuizItem[];
  bonusPlans: PreparedBonusPlan[];
  metadata?: {
    bonusCards: VocabularyCard[];
    bonusLearnedCards: VocabularyCard[];
  };
};

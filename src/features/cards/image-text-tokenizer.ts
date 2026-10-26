import type { LanguageCode } from "@/types/domain";

export interface TextSegment {
  text: string;
  isWordLike: boolean;
}

export interface IndexedTextSegment extends TextSegment {
  wordIndex: number | null;
}

export function segmentText(text: string, language: LanguageCode): TextSegment[] {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (locale: string, options: { granularity: "word" }) => {
      segment: (value: string) => Iterable<{ segment: string; isWordLike?: boolean }>;
    };
  }).Segmenter;

  if (Segmenter) {
    return Array.from(new Segmenter(language, { granularity: "word" }).segment(text)).map((part) => ({
      text: part.segment,
      isWordLike: part.isWordLike ?? false,
    }));
  }

  return text.match(/\s+|[\p{L}\p{N}]+(?:[\u2019'-][\p{L}\p{N}]+)*|[^\p{L}\p{N}\s]+/gu)?.map((part) => ({
    text: part,
    isWordLike: /[\p{L}\p{N}]/u.test(part),
  })) ?? [];
}

export function segmentTextWithWordIndices(text: string, language: LanguageCode): IndexedTextSegment[] {
  let nextWordIndex = 0;

  return segmentText(text, language).map((segment) => {
    if (!segment.isWordLike) {
      return { ...segment, wordIndex: null };
    }

    const wordIndex = nextWordIndex;
    nextWordIndex += 1;
    return { ...segment, wordIndex };
  });
}

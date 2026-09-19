import { getLanguageDisplayName } from "@/i18n/labels";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export function buildImageTextTranslateInstructions({
  locale,
  targetLanguage,
}: {
  locale: LocaleCode;
  targetLanguage: LanguageCode;
}) {
  const targetName = getLanguageDisplayName(targetLanguage, locale);
  const outputLanguage = getLanguageDisplayName(locale, locale);

  return `You are the document reconstruction, question-answering, vocabulary extraction, and translation engine for FoxiesDeck. Follow the rules below as hard constraints, not suggestions.

SOURCE LANGUAGE FILTER (do this before reconstruction):
- The only accepted source language is ${targetName} (language code "${targetLanguage}").
- Copy, reconstruct, answer, translate, or extract only text actually written in ${targetName}.
- Completely discard every other language: UI labels, watermarks, captions, names, translations, metadata, and mixed-language fragments. Do not copy discarded text into detectedText or translatedText, and do not extract entries from it.
- If the input contains no confidently identifiable ${targetName} text, return empty strings for detectedText and translatedText and return no entries or question answers.

SOURCE DOCUMENT RECONSTRUCTION:
- The input fragments may deliberately be out of order. Do not preserve input order blindly.
- Infer the most logical chronological order from explicit dates, times, page/section numbers, headings, sequence words, narrative continuity, and before/after references. Earlier events must precede later events.
- A heading belongs to the text immediately following it. Put that heading before its body, even if the heading appeared later in the input.
- If multiple independent texts/documents are present, identify their boundaries, group every fragment belonging to the same text, finish one document before moving to the next, and separate documents with one blank line.
- Preserve the accepted source wording, punctuation, paragraph breaks, and headings. Do not invent dates or events merely to force an order. If chronology is genuinely ambiguous, choose the most coherent order and preserve the available wording.
- detectedText and translatedText are different fields with different jobs. detectedText is NEVER translated: copy every accepted source sentence and heading verbatim from the input, changing only its position and adding newly generated answer lines. For example, an accepted heading "COOKING" must remain exactly "COOKING" in detectedText. translatedText must contain the same documents, headings, paragraphs, questions, and answers in exactly the same order, fully translated into ${outputLanguage} (locale code "${locale}"). Do not leave ordinary source-language sentences, headings, or labels untranslated in translatedText.

QUESTION ANSWERING:
- Detect every question written in ${targetName}, including questions inside exercises and separate document blocks.
- Answer every answerable question using the supplied text first, then straightforward general knowledge when appropriate. The answer must be concise and written in ${targetName}.
- Keep the original question and place a localized ${targetName} equivalent of "Answer:" immediately below it in detectedText. Put the translated equivalent of "Answer:" and the translated answer immediately below the translated question in translatedText.
- If a question cannot be answered reliably from the text or general knowledge, add a concise ${targetName} statement saying that the answer cannot be determined from the provided text; never invent a specific fact.
- The questionAnswers array is mandatory for every detected question and must contain the exact source question, source answer line, translated question, and translated answer line. Use an empty array only when there are no questions.

VOCABULARY:
- Create entries only after reconstruction and question answering.
- For each meaningful ${targetName} word or short fixed expression, return a concise translation and meaning in ${outputLanguage}. Keep multi-word expressions together when splitting them changes their meaning.
- Include useful vocabulary from the reconstructed text and inserted answers, remove punctuation-only tokens and duplicate source entries, and preserve first appearance order.

Return only one JSON object with no markdown or commentary:
{
  "detectedText": "reconstructed source text in ${targetName}, including headings and inserted answers",
  "translatedText": "the same reconstructed text fully translated into ${outputLanguage}, including translated headings, questions, and answers",
  "questionAnswers": [
    {
      "question": "exact question in ${targetLanguage}",
      "answer": "localized Answer line and answer in ${targetLanguage}",
      "translatedQuestion": "translated question in ${locale}",
      "translatedAnswer": "translated Answer line and answer in ${locale}"
    }
  ],
  "entries": [
    {
      "id": "entry-1",
      "source": "word or short expression in ${targetLanguage}",
      "translation": "direct translation in ${locale}",
      "meaning": "short, natural meaning in ${locale}"
    }
  ]
}

Never add an entry from a language other than ${targetName}. Never return markdown, explanations, confidence scores, chronology notes, or extra JSON fields. Keep the list focused on words a learner could reasonably add to a vocabulary deck.`;
}

export function buildImageTextTranslateTextInput(text: string, targetLanguage: LanguageCode) {
  const fragments = text
    .split(/\r?\n/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .map((fragment, index) => `<source-fragment id="fragment-${index + 1}">${fragment}</source-fragment>`)
    .join("\n");

  return `Process the following user-provided source fragments according to every reconstruction, language-filtering, chronology, question-answering, translation, and vocabulary rule in the system instructions. The source/learning language is ${targetLanguage}. The fragments may be out of order and may contain multiple independent texts. The XML tags are control markers only and must never appear in any output field.\n\n<user_text>\n${fragments}\n</user_text>`;
}

export function buildImageTextTranslateImageInput(targetLanguage: LanguageCode) {
  return `Inspect the attached image(s) and process the visible text according to every reconstruction, language-filtering, chronology, question-answering, translation, and vocabulary rule in the system instructions. The source/learning language is ${targetLanguage}. Ignore all other language text and non-text visual content.`;
}

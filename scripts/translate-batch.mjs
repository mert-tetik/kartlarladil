import fs from "node:fs";
import OpenAI from "openai";

const openai = new OpenAI();

const LOCALES = ["tr", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const LOCALE_NAMES = {
  tr: "Turkish",
  de: "German",
  ru: "Russian",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Chinese (Simplified)",
};

export async function translateBatch(words, hintsByWord) {
  const prompt = buildPrompt(words, hintsByWord);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert multilingual lexicographer. For each English word, return dictionary/lemma (root) form translations in 13 languages. Use Arabic script for Arabic, Kanji/Hiragana for Japanese, Hangul for Korean, Simplified Chinese for Chinese. Do not provide romanizations or explanations. Return valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content);
}

function buildPrompt(words, hintsByWord) {
  const localeList = LOCALES.map((locale) => `"${locale}" (${LOCALE_NAMES[locale]})`).join(", ");

  const wordObjects = words.map((word) => {
    const hints = hintsByWord[word.word] ?? {};
    const filteredHints = Object.fromEntries(
      Object.entries(hints).filter(([locale]) => LOCALES.includes(locale) && hints[locale]),
    );
    return {
      word: word.word,
      type: word.type,
      hints: filteredHints,
    };
  });

  return [
    `For each English word below, provide the dictionary/lemma (root) form translation in these languages: ${localeList}.`,
    `Return a JSON object where keys are English words and values are objects with locale codes (${LOCALES.join(", ")}) as keys and translations as values.`,
    `If a word has multiple common meanings, choose the most common one. Use the provided MUSE hints only as a guide; correct them to proper lemma forms.`,
    `\nWords:\n${JSON.stringify(wordObjects, null, 2)}`,
  ].join("\n");
}

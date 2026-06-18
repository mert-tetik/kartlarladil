import { translateBatch } from "./translate-batch.mjs";

const words = [
  { word: "accept", type: "verb" },
  { word: "ability", type: "noun" },
  { word: "abandon", type: "verb" },
  { word: "about", type: "adverb" },
  { word: "above", type: "preposition" },
  { word: "absence", type: "noun" },
  { word: "absent", type: "adjective" },
  { word: "absolute", type: "adjective" },
  { word: "absorb", type: "verb" },
  { word: "abstract", type: "adjective" },
];

const hints = {
  accept: { de: "annehmen", fr: "accepter", es: "aceptar", it: "accettare", pt: "aceitar", tr: "kabul etmek" },
  ability: { de: "fähigkeit", fr: "capacité", es: "capacidad", it: "capacità" },
};

try {
  const result = await translateBatch(words, hints);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Hata:", error.message);
  process.exit(1);
}

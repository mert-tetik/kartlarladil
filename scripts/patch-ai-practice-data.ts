import { readFileSync, writeFileSync } from "node:fs";

let content = readFileSync("src/features/ai-practice/ai-practice-data.ts", "utf-8");

// Replace OPENING_LINES usage with OPENING_LINES_BY_LANGUAGE
content = content.replace(
  "openingLinesByLanguage: OPENING_LINES[character.id] ?? {}",
  "openingLinesByLanguage: OPENING_LINES_BY_LANGUAGE[character.id] ?? {}",
);

// Add promptProfileByLocale and conversationStyleByLocale after each conversationStyle array
const characterIds = [
  "gentle-companion",
  "gothic-calm",
  "campus-friend",
  "soft-artist",
  "skater-coach",
  "study-buddy",
  "sleepy-student",
  "friendly-worker",
  "warm-grandmother",
  "wise-elder",
];

for (const id of characterIds) {
  // Find the conversationStyle closing bracket for this character
  const marker = `id: "${id}"`;
  const startIdx = content.indexOf(marker);
  if (startIdx === -1) {
    console.warn(`Character ${id} not found`);
    continue;
  }

  // Find the conversationStyle array end after this character
  const searchStart = startIdx;
  const styleEndMatch = content.slice(searchStart).match(/conversationStyle:\s*\[[\s\S]*?\],\n/);
  if (!styleEndMatch) {
    console.warn(`conversationStyle not found for ${id}`);
    continue;
  }

  const insertPos = searchStart + styleEndMatch.index! + styleEndMatch[0].length;
  const insert = `    promptProfileByLocale: PROMPT_PROFILES_BY_LOCALE["${id}"],
    conversationStyleByLocale: CONVERSATION_STYLES_BY_LOCALE["${id}"],
`;

  content = content.slice(0, insertPos) + insert + content.slice(insertPos);
}

writeFileSync("src/features/ai-practice/ai-practice-data.ts", content);
console.log("Patched ai-practice-data.ts");

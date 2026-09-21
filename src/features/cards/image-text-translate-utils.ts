export function getTranslationPreview(sentence: string, maxLength = 120) {
  const normalized = sentence.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

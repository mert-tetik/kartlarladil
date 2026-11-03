export function getQuizPromptTerm(term: string) {
  const firstTerm = term.split(",", 1)[0]?.trim();
  return firstTerm || term;
}

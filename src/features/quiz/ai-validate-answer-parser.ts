export function parseAiValidationResponse(raw: string): boolean {
  const normalized = raw.trim();

  if (!normalized) {
    return false;
  }

  try {
    const parsed = JSON.parse(normalized) as { accepted?: unknown };
    return parsed.accepted === true;
  } catch {
    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch) {
      return parseAiValidationResponse(fencedMatch[1] ?? "");
    }

    const objectMatch = normalized.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return parseAiValidationResponse(objectMatch[0]);
    }

    const acceptedMatch = normalized.match(/accepted\s*["']?\s*:\s*(true|false)/i);
    if (acceptedMatch) {
      return acceptedMatch[1]?.toLowerCase() === "true";
    }

    return false;
  }
}

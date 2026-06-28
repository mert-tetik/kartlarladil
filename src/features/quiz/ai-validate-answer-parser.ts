export function parseAiValidationResponse(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { accepted?: unknown };
    return parsed.accepted === true;
  } catch {
    return false;
  }
}

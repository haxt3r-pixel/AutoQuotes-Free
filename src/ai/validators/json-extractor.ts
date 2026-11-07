/**
 * Robust JSON extraction from LLM responses.
 * LLMs often wrap JSON in markdown fences or add commentary.
 */

export function extractJson<T>(raw: string): T {
  // Try direct parse first
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    // Fall through to extraction
  }

  // Try extracting from ```json ... ``` fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Fall through
    }
  }

  // Try finding JSON array or object in the text
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  throw new Error(`Unable to extract valid JSON from response: ${raw.slice(0, 200)}...`);
}
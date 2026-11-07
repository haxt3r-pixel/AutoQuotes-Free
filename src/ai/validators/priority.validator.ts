import type { CategorizedItem } from '../ai.types.js';

const VALID_CATEGORIES = ['safety_critical', 'required', 'recommended', 'optional'] as const;

/**
 * Validates and sanitizes LLM categorization output.
 * Forces unknown categories to 'recommended' as a safe default.
 */
export function validateCategories(raw: unknown[]): CategorizedItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('Expected an array of categorized items');
  }

  return raw.map((item: any, i: number): CategorizedItem => {
    const index = typeof item.index === 'number' ? item.index : i;
    const category = VALID_CATEGORIES.includes(item.category)
      ? item.category
      : 'recommended'; // safe fallback
    const reason = typeof item.reason === 'string'
      ? item.reason
      : 'No reason provided';

    return { index, category, reason };
  });
}
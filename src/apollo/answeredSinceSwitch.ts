import { canonicalStringify } from '@apollo/client/utilities';

/**
 * The queries the network answered, without errors, in the app's language
 * since the last switch, by name and variables; the language catch-up skips
 * them, whether a resync or a mounting screen asked. Per switch, not per
 * language: the names are shared entities, so a screen paused through `en` →
 * `es` → `en` holds what the `es` screens wrote. Nothing is held before a
 * first switch.
 */
let answered: Set<string> | null = null;

// Each search term and page is its own key. Past the cap the stalest go, and a
// dropped one costs only a catch-up re-asking it.
const MAX_ANSWERED = 500;

const keyOf = (operationName: string, variables: unknown): string =>
  `${operationName}:${canonicalStringify(variables ?? {})}`;

export const startAnswersForSwitch = (): void => {
  answered = new Set();
};

export const noteAnsweredInLanguage = (
  operationName: string,
  variables: unknown,
): void => {
  if (!answered) return;
  const key = keyOf(operationName, variables);
  // Re-added, so the order runs from the longest unanswered.
  answered.delete(key);
  answered.add(key);
  if (answered.size <= MAX_ANSWERED) return;
  const [oldest] = answered;
  if (oldest !== undefined) answered.delete(oldest);
};

export const wasAnsweredSinceSwitch = (
  operationName: string,
  variables: unknown,
): boolean => answered?.has(keyOf(operationName, variables)) ?? false;

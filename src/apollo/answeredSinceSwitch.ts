import { canonicalStringify } from '@apollo/client/utilities';

/**
 * Answers since the last language switch or resync, by name and variables,
 * counting the erred ones in a row. Per switch, not per language: names are shared entities,
 * so a screen paused through `en` → `es` → `en` holds what `es` screens wrote.
 */
let answered: Map<string, number> | null = null;

// Each search term and page is its own key. Past the cap the stalest go, and a
// dropped one costs only a catch-up re-asking it.
const MAX_ANSWERED = 500;

// An answer with errors is asked again by the next catch-ups, this many times
// in all: a query that errs every time is otherwise re-asked after every
// navigation for the rest of the session.
const MAX_ERRED_ANSWERS = 3;

const keyOf = (operationName: string, variables: unknown): string =>
  `${operationName}:${canonicalStringify(variables ?? {})}`;

export const startAnswersForSwitch = (): void => {
  answered = new Map();
};

/**
 * Forgets every answer at a session end: the keys carry the account's search
 * terms and ids, and the cache they describe is cleared with it. The catch-up
 * a switch started goes on, so the next session's answers are still noted.
 */
export const forgetAnswersSinceSwitch = (): void => {
  answered?.clear();
};

export const noteAnsweredInLanguage = (
  operationName: string,
  variables: unknown,
  { erred = false }: { erred?: boolean } = {},
): void => {
  if (!answered) return;
  const key = keyOf(operationName, variables);
  const before = answered.get(key);
  // One answered whole stays answered: a later error is not the old language.
  const erredInARow = erred && before !== 0 ? (before ?? 0) + 1 : 0;
  // Re-added, so the order runs from the longest unanswered.
  answered.delete(key);
  answered.set(key, erredInARow);
  if (answered.size <= MAX_ANSWERED) return;
  const [oldest] = answered.keys();
  if (oldest !== undefined) answered.delete(oldest);
};

export const wasAnsweredSinceSwitch = (
  operationName: string,
  variables: unknown,
): boolean => {
  const erredInARow = answered?.get(keyOf(operationName, variables));
  return (
    erredInARow !== undefined &&
    (erredInARow === 0 || erredInARow >= MAX_ERRED_ANSWERS)
  );
};

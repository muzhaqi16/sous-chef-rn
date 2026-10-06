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

const keyOf = (operationName: string, variables: unknown): string =>
  `${operationName}:${canonicalStringify(variables ?? {})}`;

export const startAnswersForSwitch = (): void => {
  answered = new Set();
};

export const noteAnsweredInLanguage = (
  operationName: string,
  variables: unknown,
): void => {
  answered?.add(keyOf(operationName, variables));
};

export const wasAnsweredSinceSwitch = (
  operationName: string,
  variables: unknown,
): boolean => answered?.has(keyOf(operationName, variables)) ?? false;

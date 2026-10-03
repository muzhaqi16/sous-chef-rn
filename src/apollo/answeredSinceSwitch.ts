import { canonicalStringify } from '@apollo/client/utilities';

/**
 * The operations the network answered in the app's language since the last
 * switch, by name and variables. The language catch-up skips them: a screen
 * first opened after the switch asked as it mounted. Nothing is held before a
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

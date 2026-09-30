import { useState } from 'react';

/**
 * Keeps the last successful value when a later query fails. For queries on
 * `errorPolicy: 'ignore'`, where `undefined` would otherwise read as "empty".
 * `key` names the subject (the variables that identify it): a value is only
 * ever preserved for the subject it was loaded for.
 */
export function usePreservedQueryData<T>(
  currentData: T | undefined,
  initialValue: T,
  key: string,
): T {
  const [lastSuccessful, setLastSuccessful] = useState<{
    key: string;
    value: T;
  } | null>(null);

  if (
    currentData !== undefined &&
    (lastSuccessful === null ||
      lastSuccessful.value !== currentData ||
      lastSuccessful.key !== key)
  ) {
    setLastSuccessful({ key, value: currentData });
  }

  if (currentData !== undefined) {
    return currentData;
  }

  return lastSuccessful !== null && lastSuccessful.key === key
    ? lastSuccessful.value
    : initialValue;
}

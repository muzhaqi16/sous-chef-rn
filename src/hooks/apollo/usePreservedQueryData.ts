import { useState } from 'react';

/**
 * Keeps the last successful value when a later query fails. For queries on
 * `errorPolicy: 'ignore'`, where `undefined` would otherwise read as "empty".
 */
export function usePreservedQueryData<T>(
  currentData: T | undefined,
  initialValue: T,
): T {
  const [lastSuccessfulValue, setLastSuccessfulValue] =
    useState<T>(initialValue);
  // Seeded `undefined`, NOT `currentData`: the persisted cache can resolve
  // synchronously on render #1, and seeding it would skip storing that value —
  // leaving a later network error with nothing to preserve.
  const [prevData, setPrevData] = useState<T | undefined>(undefined);

  if (currentData !== prevData) {
    setPrevData(currentData);
    if (currentData !== undefined) {
      setLastSuccessfulValue(currentData);
    }
  }

  if (currentData !== undefined) {
    return currentData;
  }

  return lastSuccessfulValue;
}

/** Array form of `usePreservedQueryData` — always an array, never undefined. */
export function usePreservedArrayData<T>(
  currentData: T[] | undefined | null,
): T[] {
  return usePreservedQueryData(currentData ?? undefined, [] as T[]);
}

import { useState } from 'react';
import type { WatchQueryFetchPolicy } from '@apollo/client';

/**
 * For a read cached without its day, so a new day keeps the last answer on
 * screen offline, and a `cache-first` read alone would answer with it for good.
 * The network confirms each `key` (a subject and its day) once; held at
 * `fetchPolicy` after that, a refocus costs nothing.
 */
export function useDayConfirmedRead(
  key: string | null,
  fetchPolicy: WatchQueryFetchPolicy = 'cache-first',
) {
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const isConfirmed = key !== null && confirmedKey === key;
  const policy: {
    fetchPolicy: WatchQueryFetchPolicy;
    nextFetchPolicy: WatchQueryFetchPolicy;
  } = {
    fetchPolicy: isConfirmed ? fetchPolicy : 'cache-and-network',
    nextFetchPolicy: fetchPolicy,
  };

  return {
    policy,
    /** Call while rendering with the key the read has settled on, or null. */
    markAnswered: (answeredKey: string | null) => {
      if (key && !isConfirmed && answeredKey === key) setConfirmedKey(key);
    },
  };
}

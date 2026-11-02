import { useEffect, useState, useSyncExternalStore } from 'react';
import { feedEngine } from '#/apollo/feed/feedEngine';
import { positionOf, subscribeToPositions } from '#/apollo/feed/feedPositions';
import { SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { holdListInMemory } from '../offline/listShards';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The feed keeps the rows current, so reading them asks the network nothing. */
const SYNCED_READ: { fetchPolicy: 'cache-first'; refetchOn: false } = {
  fetchPolicy: 'cache-first',
  refetchOn: false,
};

/**
 * How a screen reads a list's rows. A list the feed holds reads from the device;
 * any other reads as it always has. The feed omits what a list shows from
 * outside itself, so a held list last read in full a day ago reads again, with
 * the screen not waiting on it.
 */
export function useListReadPolicy(
  listId: string | null | undefined,
): typeof SYNCED_READ | undefined {
  const feedOn = useFeatureFlag('listChangeFeed');

  // Before the first read below it: a stored list counts as held. Adjusting
  // state while rendering, as an effect would run after that read has missed.
  const [inMemory, setInMemory] = useState<string | null>(null);
  if (listId && listId !== inMemory) {
    holdListInMemory(listId);
    setInMemory(listId);
  }

  const synced = useSyncExternalStore(
    subscribeToPositions,
    () => feedOn && !!listId && positionOf(listId) !== undefined,
  );

  useEffect(() => {
    if (!synced || !listId) return;
    const position = positionOf(listId);
    if (position && Date.now() - position.snapshotAt > DAY_MS) {
      feedEngine.refresh(SyncScopeKind.ShoppingList, listId);
    }
  }, [synced, listId]);

  return synced ? SYNCED_READ : undefined;
}

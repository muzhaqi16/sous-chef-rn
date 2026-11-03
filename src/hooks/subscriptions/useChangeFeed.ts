import { useEffect } from 'react';
import { useSubscription } from '@apollo/client/react';
import {
  FeedPokesDocument,
  type FeedPokesSubscription,
} from '#/apollo/feed/feed.generated';
import { feedEngine } from '#/apollo/feed/feedEngine';
import { SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useSubscriptionTransportRecovery } from './useSubscriptionTransportRecovery';

/**
 * Runs the change feed for the signed-in person. A poke holds no row and a lost
 * one only delays a pull, so it stays uncached and the connection is what
 * guarantees a catch-up.
 */
const kindsOf = (lists: boolean, pantries: boolean): SyncScopeKind[] => [
  ...(lists ? [SyncScopeKind.ShoppingList] : []),
  ...(pantries ? [SyncScopeKind.Pantry] : []),
];

export function useChangeFeed(userId: string): void {
  const lists = useFeatureFlag('listChangeFeed');
  const pantries = useFeatureFlag('pantryChangeFeed');

  useEffect(() => {
    const started = kindsOf(lists, pantries);
    if (started.length === 0) return;
    feedEngine.start(started);
    return () => feedEngine.stop();
  }, [lists, pantries, userId]);

  const kinds = kindsOf(lists, pantries);
  const skip = kinds.length === 0;
  const pokes = useSubscription<FeedPokesSubscription>(FeedPokesDocument, {
    skip,
    variables: { kinds },
    fetchPolicy: 'no-cache',
    onData: ({ data }) => {
      if (data.data) feedEngine.receivePoke(data.data.mySyncPokes);
    },
  });
  useSubscriptionTransportRecovery(FeedPokesDocument, pokes, skip);
}

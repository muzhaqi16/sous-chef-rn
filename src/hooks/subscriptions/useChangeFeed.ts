import { useEffect } from 'react';
import { useSubscription } from '@apollo/client/react';
import {
  FeedPokesDocument,
  type FeedPokesSubscription,
} from '#/apollo/feed/feed.generated';
import { feedEngine } from '#/apollo/feed/feedEngine';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useSubscriptionTransportRecovery } from './useSubscriptionTransportRecovery';

/**
 * Runs the change feed for the signed-in person. A poke holds no row and a lost
 * one only delays a pull, so it stays uncached and the connection is what
 * guarantees a catch-up.
 */
export function useChangeFeed(userId: string): void {
  const enabled = useFeatureFlag('listChangeFeed');

  useEffect(() => {
    if (!enabled) return;
    feedEngine.start();
    return () => feedEngine.stop();
  }, [enabled, userId]);

  const skip = !enabled;
  const pokes = useSubscription<FeedPokesSubscription>(FeedPokesDocument, {
    skip,
    fetchPolicy: 'no-cache',
    onData: ({ data }) => {
      if (data.data) feedEngine.receivePoke(data.data.mySyncPokes);
    },
  });
  useSubscriptionTransportRecovery(FeedPokesDocument, pokes, skip);
}

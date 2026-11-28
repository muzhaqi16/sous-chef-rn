import type { FeedAdapter } from '#apollo/feed/types';
import { homeFeedAdapter } from './home/offline/homeFeed';
import { pantryFeedAdapter } from './pantry/offline/pantryFeed';
import { listFeedAdapter } from './shoppingList/offline/listFeed';

/**
 * Every feature's feed scope, for the feed engine (`feedRegistry`). Apart from
 * `registry.data.ts` because a feed reads the write kernel that registry feeds:
 * one module holding both would load in a cycle.
 */
export const FEATURE_FEED_ADAPTERS: readonly FeedAdapter[] = [
  listFeedAdapter,
  pantryFeedAdapter,
  homeFeedAdapter,
];

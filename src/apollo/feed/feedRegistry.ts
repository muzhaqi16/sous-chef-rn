import { listFeedAdapter } from '#features/shoppingList/offline/listFeed';
import type { FeedAdapter } from './types';

/** One entry per scope kind this build handles. */
export const FEED_ADAPTERS: readonly FeedAdapter[] = [listFeedAdapter];

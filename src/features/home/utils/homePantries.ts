import type { ApolloCache } from '@apollo/client';
import { defaultPantryOf } from '#domain/homePantries';
import { HomePantries_HomeFragmentDoc } from './homePantries.generated';

/** The home's default pantry id, read straight from the cache. */
export const readDefaultPantryId = (cache: ApolloCache, homeId: string) => {
  const cacheId = cache.identify({ __typename: 'Home', id: homeId });
  if (!cacheId) return null;
  const home = cache.readFragment({
    id: cacheId,
    fragment: HomePantries_HomeFragmentDoc,
  });
  return defaultPantryOf(home)?.id ?? null;
};

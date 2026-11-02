/**
 * The one place `Home.isDefault` is written locally — the `MarkHomeAsDefault`
 * payload never returns the flag.
 */

import type { ApolloCache, Reference } from '@apollo/client';
import { DefaultHomeCacheWrites_IdentityFragmentDoc } from './defaultHomeCacheWrites.generated';

/** Cached `homes` edge: normalized `{ node: Reference }`, or a bare ref. */
type HomeEdge = { node?: Reference } | Reference;

const cachedHomes = (cache: ApolloCache) => {
  const found: Array<{ cacheId: string; homeId: unknown }> = [];

  cache.modify({
    fields: {
      homes(
        existingHomes: { edges?: HomeEdge[]; readonly __ref?: string },
        { readField },
      ) {
        if (!existingHomes.edges) return existingHomes;

        existingHomes.edges.forEach((edge: HomeEdge) => {
          const homeRef = 'node' in edge ? edge.node ?? edge : edge;
          const cacheId = cache.identify(homeRef);
          if (cacheId)
            found.push({ cacheId, homeId: readField('id', homeRef) });
        });

        return existingHomes;
      },
    },
  });

  return found;
};

/**
 * Make `defaultHomeId` the only cached home carrying `isDefault: true`.
 *
 * All or nothing: `cache.modify` cannot add a field to a record the store does
 * not hold, so an uncached target would clear every holder and set none.
 */
export const applyDefaultHome = (
  cache: ApolloCache,
  defaultHomeId: string,
): void => {
  const targetCacheId = cache.identify({
    __typename: 'Home',
    id: defaultHomeId,
  });
  const targetIsCached =
    !!targetCacheId &&
    cache.readFragment({
      id: targetCacheId,
      fragment: DefaultHomeCacheWrites_IdentityFragmentDoc,
      optimistic: true,
    }) !== null;

  if (!targetIsCached) return;

  cachedHomes(cache).forEach(({ cacheId, homeId }) => {
    cache.modify({
      id: cacheId,
      fields: { isDefault: () => homeId === defaultHomeId },
    });
  });

  // A home created or joined this session is cached before it reaches the
  // connection, so the flag has to be written to it directly.
  cache.modify({ id: targetCacheId, fields: { isDefault: () => true } });
};

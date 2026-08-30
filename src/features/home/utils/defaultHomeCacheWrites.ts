/**
 * The one place `Home.isDefault` is written locally — the `MarkHomeAsDefault`
 * payload never returns the flag.
 */

import { gql, type ApolloCache, type Reference } from '@apollo/client';

/** Cached `homes` edge: normalized `{ node: Reference }`, or a bare ref. */
type HomeEdge = { node?: Reference } | Reference;

/** Existence only — a home cached without `isDefault` still satisfies it. */
const HOME_IDENTITY = gql`
  fragment DefaultHomeWrite_identity on Home {
    id
  }
`;

const HOME_IS_DEFAULT = gql`
  fragment DefaultHomeWrite_isDefault on Home {
    id
    isDefault
  }
`;

/**
 * Pre-write `isDefault` per cache id. `undefined` means the record carried no
 * such field, so restoring it removes the field rather than writing `false`.
 */
type DefaultHomeSnapshot = ReadonlyMap<string, boolean | undefined>;

interface ApplyDefaultHomeResult {
  applied: boolean;
  snapshot: DefaultHomeSnapshot;
}

const cachedHomes = (cache: ApolloCache) => {
  const found: Array<{ cacheId: string; homeId: unknown }> = [];

  cache.modify({
    fields: {
      homes(
        existingHomes: { edges?: HomeEdge[]; readonly __ref?: string },
        { readField },
      ) {
        if (!existingHomes || !existingHomes.edges) return existingHomes;

        existingHomes.edges.forEach((edge: HomeEdge) => {
          const homeRef = ('node' in edge && edge.node) || edge;
          if (!homeRef) return;
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

const readIsDefault = (cache: ApolloCache, cacheId: string) =>
  cache.readFragment<{ isDefault?: boolean | null }>({
    id: cacheId,
    fragment: HOME_IS_DEFAULT,
  })?.isDefault ?? undefined;

/**
 * Make `defaultHomeId` the only cached home carrying `isDefault: true`.
 *
 * All or nothing: `cache.modify` cannot add a field to a record the store does
 * not hold, so an uncached target would clear every holder and set none.
 */
export const applyDefaultHome = (
  cache: ApolloCache,
  defaultHomeId: string,
): ApplyDefaultHomeResult => {
  const targetCacheId = cache.identify({
    __typename: 'Home',
    id: defaultHomeId,
  });
  const targetIsCached =
    !!targetCacheId &&
    cache.readFragment<{ id: string }>({
      id: targetCacheId,
      fragment: HOME_IDENTITY,
    }) !== null;

  if (!targetIsCached) {
    return { applied: false, snapshot: new Map() };
  }

  const homes = cachedHomes(cache);
  const snapshot = new Map<string, boolean | undefined>();

  homes.forEach(({ cacheId }) => {
    snapshot.set(cacheId, readIsDefault(cache, cacheId));
  });

  homes.forEach(({ cacheId, homeId }) => {
    cache.modify({
      id: cacheId,
      fields: { isDefault: () => homeId === defaultHomeId },
    });
  });

  // A home created or joined this session is cached before it reaches the
  // connection, so the flag has to be written to it directly.
  if (targetCacheId && !snapshot.has(targetCacheId)) {
    snapshot.set(targetCacheId, readIsDefault(cache, targetCacheId));
    cache.modify({ id: targetCacheId, fields: { isDefault: () => true } });
  }

  return { applied: true, snapshot };
};

/** Restore what `applyDefaultHome` found — it cannot be re-derived after. */
export const restoreDefaultHome = (
  cache: ApolloCache,
  snapshot: DefaultHomeSnapshot,
) => {
  snapshot.forEach((wasDefault, cacheId) => {
    cache.modify({
      id: cacheId,
      fields: {
        isDefault: (_existing, { DELETE }) =>
          wasDefault === undefined ? DELETE : wasDefault,
      },
    });
  });
};

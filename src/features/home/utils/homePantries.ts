import { gql, type ApolloCache } from '@apollo/client';
import { extractNodes } from '#/utils/connectionUtils';

const HOME_PANTRIES = gql`
  fragment HomePantries_home on Home {
    id
    pantriesConnection {
      edges {
        node {
          id
          isDefault
        }
      }
    }
  }
`;

/** A home's pantries. `GetHomes` and `GetHome` both select the connection. */
export type HomePantries = {
  pantriesConnection?: {
    edges?: Array<{ node?: { id: string; isDefault?: boolean } | null } | null>;
  } | null;
};

export const pantriesOf = (home: HomePantries | undefined) =>
  extractNodes(home?.pantriesConnection) as Array<{
    id: string;
    isDefault?: boolean;
  }>;

/**
 * A hint for an optimistic switch; the server's `defaultPantry` overwrites it
 * when the mutation resolves.
 */
export const defaultPantryOf = (home: HomePantries | undefined) => {
  const pantries = pantriesOf(home);
  return pantries.find(p => p.isDefault) ?? pantries[0];
};

/** The home's default pantry id, read straight from the cache. */
export const readDefaultPantryId = (cache: ApolloCache, homeId: string) => {
  const cacheId = cache.identify({ __typename: 'Home', id: homeId });
  if (!cacheId) return null;
  const home = cache.readFragment<HomePantries>({
    id: cacheId,
    fragment: HOME_PANTRIES,
  });
  return defaultPantryOf(home ?? undefined)?.id ?? null;
};

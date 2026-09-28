import { gql, type ApolloCache } from '@apollo/client';
import { defaultPantryOf, type HomePantries } from '#domain/homePantries';

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

/** The home's default pantry id, read straight from the cache. */
export const readDefaultPantryId = (cache: ApolloCache, homeId: string) => {
  const cacheId = cache.identify({ __typename: 'Home', id: homeId });
  if (!cacheId) return null;
  const home = cache.readFragment<HomePantries>({
    id: cacheId,
    fragment: HOME_PANTRIES,
  });
  return defaultPantryOf(home)?.id ?? null;
};

import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { readDefaultPantryId } from '../homePantries';

// The home as the homes query stores it: `pantriesConnection(first: 20)`.
const STORED_HOME = gql`
  fragment _StoredHomePantries on Home {
    id
    pantriesConnection(first: 20) {
      edges {
        node {
          id
          isDefault
        }
      }
    }
  }
`;

describe('readDefaultPantryId', () => {
  it('reads the default pantry of a home the homes query stored', () => {
    const cache = makeCache();
    cache.writeFragment({
      id: 'Home:h-1',
      fragment: STORED_HOME,
      data: {
        __typename: 'Home',
        id: 'h-1',
        pantriesConnection: {
          __typename: 'PantryConnection',
          edges: [
            {
              __typename: 'PantryEdge',
              node: { __typename: 'Pantry', id: 'p-1', isDefault: false },
            },
            {
              __typename: 'PantryEdge',
              node: { __typename: 'Pantry', id: 'p-2', isDefault: true },
            },
          ],
        },
      },
    });

    expect(readDefaultPantryId(cache, 'h-1')).toBe('p-2');
  });

  it('reads none for a home the cache lacks', () => {
    expect(readDefaultPantryId(makeCache(), 'h-1')).toBeNull();
  });
});

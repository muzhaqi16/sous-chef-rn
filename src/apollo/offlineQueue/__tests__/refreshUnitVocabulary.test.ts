import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  registerApolloClient,
  clearApolloClient,
} from '#/apollo/clientRegistry';
import { refreshUnitVocabulary } from '#/apollo/offlineQueue/refreshUnitVocabulary';

jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      setCachedUnits: jest.fn(),
      setLastUnitsFetchedAt: jest.fn(),
    }),
  },
}));

const UNIT_FRAGMENT = gql`
  fragment RetiredUnit on Unit {
    id
    symbol
    name
  }
`;

const UNITS_QUERY = gql`
  query CachedUnits {
    units {
      id
      symbol
      name
    }
  }
`;

/**
 * The repair that makes a stale unit reference resolvable must not destroy what
 * the retry reads. A retired unit reached only through an evicted root field is
 * the whole case: the queued write names its id, and the sync builder reads the
 * cached row for the symbol the server re-resolves from.
 */
describe('refreshUnitVocabulary keeps what the retry needs', () => {
  const seed = () => {
    const cache = makeCache();
    cache.writeQuery({
      query: UNITS_QUERY,
      data: {
        units: [
          {
            __typename: 'Unit',
            id: 'unit-retired',
            symbol: 'tbsp',
            name: 'Tablespoon',
          },
        ],
      },
    });
    registerApolloClient({ cache } as never);
    return cache;
  };

  afterEach(() => clearApolloClient());

  it('leaves the retired unit readable after the refresh', () => {
    const cache = seed();

    refreshUnitVocabulary();

    expect(
      cache.readFragment({
        id: 'Unit:unit-retired',
        fragment: UNIT_FRAGMENT,
        fragmentName: 'RetiredUnit',
      }),
    ).toMatchObject({ id: 'unit-retired', symbol: 'tbsp' });
  });

  it('still sends the next unit lookup to the network', () => {
    const cache = seed();

    refreshUnitVocabulary();

    expect(cache.readQuery({ query: UNITS_QUERY })).toBeNull();
  });
});

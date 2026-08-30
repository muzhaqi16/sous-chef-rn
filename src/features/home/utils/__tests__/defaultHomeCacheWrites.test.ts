import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  applyDefaultHome,
  restoreDefaultHome,
} from '../defaultHomeCacheWrites';

const HOMES = gql`
  query TestHomes {
    homes {
      __typename
      edges {
        __typename
        node {
          __typename
          id
          isDefault
        }
      }
    }
  }
`;

const HOME_FIELDS = gql`
  fragment TestHomeFields on Home {
    id
    isDefault
  }
`;

interface HomesResult {
  homes: { edges: Array<{ node: { id: string; isDefault: boolean } }> };
}

const seed = (homes: Array<{ id: string; isDefault: boolean }>) => {
  const cache = makeCache();
  cache.writeQuery({
    query: HOMES,
    data: {
      homes: {
        __typename: 'HomeConnection',
        edges: homes.map(home => ({
          __typename: 'HomeEdge',
          node: { __typename: 'Home', ...home },
        })),
      },
    },
  });
  return cache;
};

const holders = (cache: ReturnType<typeof makeCache>) =>
  (cache.readQuery<HomesResult>({ query: HOMES })?.homes.edges ?? [])
    .filter(edge => edge.node.isDefault)
    .map(edge => edge.node.id);

describe('applyDefaultHome', () => {
  it('moves the flag to the target', () => {
    const cache = seed([
      { id: 'home-A', isDefault: true },
      { id: 'home-B', isDefault: false },
    ]);

    expect(applyDefaultHome(cache, 'home-B').applied).toBe(true);
    expect(holders(cache)).toEqual(['home-B']);
  });

  it('writes nothing when the target is not cached, rather than clearing every holder', () => {
    const cache = seed([
      { id: 'home-A', isDefault: true },
      { id: 'home-B', isDefault: false },
    ]);

    const { applied } = applyDefaultHome(cache, 'home-C');

    expect(applied).toBe(false);
    // The account keeps the default it had; no-holder is a state the server
    // never has.
    expect(holders(cache)).toEqual(['home-A']);
  });

  it('reaches a home cached outside the connection', () => {
    const cache = seed([{ id: 'home-A', isDefault: true }]);
    cache.writeFragment({
      id: 'Home:home-new',
      fragment: HOME_FIELDS,
      data: { __typename: 'Home', id: 'home-new', isDefault: false },
    });

    expect(applyDefaultHome(cache, 'home-new').applied).toBe(true);
    expect(holders(cache)).toEqual([]);
    expect(
      cache.readFragment<{ isDefault: boolean }>({
        id: 'Home:home-new',
        fragment: HOME_FIELDS,
      })?.isDefault,
    ).toBe(true);
  });
});

describe('applyDefaultHome retried once the target lands', () => {
  it('puts the flag on a target that arrives after the first attempt', () => {
    const cache = seed([{ id: 'home-A', isDefault: true }]);

    // First attempt: the target is not in the store at all.
    expect(applyDefaultHome(cache, 'home-new').applied).toBe(false);
    expect(holders(cache)).toEqual(['home-A']);

    // It arrives — a create's `update`, or a join's refetch.
    cache.writeFragment({
      id: 'Home:home-new',
      fragment: HOME_FIELDS,
      data: { __typename: 'Home', id: 'home-new', isDefault: false },
    });

    expect(applyDefaultHome(cache, 'home-new').applied).toBe(true);
    expect(
      cache.readFragment<{ isDefault: boolean }>({
        id: 'Home:home-new',
        fragment: HOME_FIELDS,
      })?.isDefault,
    ).toBe(true);
    expect(holders(cache)).toEqual([]);
  });
});

describe('restoreDefaultHome', () => {
  it('puts back the exact flags the write found', () => {
    const cache = seed([
      { id: 'home-A', isDefault: true },
      { id: 'home-B', isDefault: false },
    ]);

    const { snapshot } = applyDefaultHome(cache, 'home-B');
    expect(holders(cache)).toEqual(['home-B']);

    restoreDefaultHome(cache, snapshot);
    expect(holders(cache)).toEqual(['home-A']);
  });

  it('leaves every flag alone when no home held it', () => {
    const cache = seed([
      { id: 'home-A', isDefault: false },
      { id: 'home-B', isDefault: false },
    ]);

    const { snapshot } = applyDefaultHome(cache, 'home-B');
    restoreDefaultHome(cache, snapshot);

    expect(holders(cache)).toEqual([]);
  });
});

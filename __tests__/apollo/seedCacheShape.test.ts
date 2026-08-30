/**
 * A pre-seeded cache must hold a state the cache could have reached by serving
 * a real response.
 *
 * `seedCache` writes directly, bypassing the network, which makes it the one
 * place where a test can put the production cache into a shape production
 * cannot produce. Two ways it used to: a collection of identified children was
 * stored as an opaque blob rather than as records and references, and the
 * selection was synthesized from the fixture's own keys — so a seed could never
 * be incomplete, and the completeness contract every other fixture is held to
 * simply did not apply to the 35 files that seed.
 */
import { gql } from '@apollo/client';
import { seedCache } from '#/test-utils/apolloMockProvider';

const BRANDS = gql`
  fragment SeedProbe_ItemBrands on Item {
    __typename
    id
    name
    brands {
      __typename
      brand {
        __typename
        id
        name
      }
    }
  }
`;

describe('a seeded collection of entities is normalized', () => {
  const seeded = () =>
    seedCache([
      {
        __typename: 'Item',
        id: 'item-1',
        name: 'Flour',
        brands: [
          {
            __typename: 'ItemBrand',
            brand: { __typename: 'Brand', id: 'brand-1', name: 'Acme' },
          },
          {
            __typename: 'ItemBrand',
            brand: { __typename: 'Brand', id: 'brand-2', name: 'Bravo' },
          },
        ],
      },
    ]);

  it('gives each identified child its own record', () => {
    const extracted = seeded().extract();
    expect(extracted['Brand:brand-1']).toMatchObject({ name: 'Acme' });
    expect(extracted['Brand:brand-2']).toMatchObject({ name: 'Bravo' });
  });

  it('reads a child back directly', () => {
    const read = seeded().readFragment<{ name: string }>({
      id: 'Brand:brand-1',
      fragment: gql`
        fragment SeedProbe_Brand on Brand {
          __typename
          id
          name
        }
      `,
    });
    expect(read?.name).toBe('Acme');
  });

  it('shows a later write to the child through the parent', () => {
    // The point of normalizing: the parent holds a reference, so a normalized
    // write to the child reaches every reader of the parent. Stored as a blob,
    // the parent kept its own frozen copy and this was invisible.
    const cache = seeded();
    cache.writeFragment({
      id: 'Brand:brand-1',
      fragment: gql`
        fragment SeedProbe_BrandRename on Brand {
          __typename
          id
          name
        }
      `,
      data: { __typename: 'Brand', id: 'brand-1', name: 'Renamed' },
    });

    const parent = cache.readFragment<{
      brands: Array<{ brand: { name: string } }>;
    }>({ id: 'Item:item-1', fragment: BRANDS });

    expect(parent?.brands[0].brand.name).toBe('Renamed');
  });
});

/** The guard that reports an incomplete write, so its firing can be asserted. */
const guard = require('../setup/apolloCacheWriteGuard') as {
  peekCollectedCacheWriteErrors: () => Array<{ message: string }>;
  resetCollectedCacheWriteErrors: () => void;
};

describe('a seed can be held to a real selection', () => {
  afterEach(() => guard.resetCollectedCacheWriteErrors());

  it('reports a fixture too thin for the fragment it names', () => {
    // The point of the checked form. A derived selection is built FROM the
    // fixture's keys, so it can never be incomplete and cannot hold the seed to
    // anything — which is why suites in the migration had to be fixed by
    // hand-enlarging fixtures instead of being told what was missing.
    seedCache([
      {
        fragment: BRANDS,
        fragmentName: 'SeedProbe_ItemBrands',
        // `brands` is selected and not stated.
        data: { __typename: 'Item', id: 'item-3', name: 'Salt' },
      },
    ]);

    const reported = guard.peekCollectedCacheWriteErrors();
    guard.resetCollectedCacheWriteErrors();
    expect(reported.map(e => e.message).join('\n')).toContain(
      "Missing field 'brands'",
    );
  });

  it('says nothing when the derived form is used, which is the gap', () => {
    // Stated plainly rather than left implicit: the same too-thin entity in the
    // derived form reports NOTHING, because its selection is whatever it
    // carries. That is why the count of files still using it is ratcheted.
    seedCache([{ __typename: 'Item', id: 'item-4', name: 'Pepper' }]);

    const reported = guard.peekCollectedCacheWriteErrors();
    guard.resetCollectedCacheWriteErrors();
    expect(reported).toEqual([]);
  });

  it('writes exactly what the given fragment selects', () => {
    const cache = seedCache([
      {
        fragment: BRANDS,
        fragmentName: 'SeedProbe_ItemBrands',
        data: {
          __typename: 'Item',
          id: 'item-2',
          name: 'Sugar',
          brands: [],
        },
      },
    ]);

    const read = cache.readFragment<{ name: string; brands: unknown[] }>({
      id: 'Item:item-2',
      fragment: BRANDS,
      fragmentName: 'SeedProbe_ItemBrands',
    });
    expect(read).toMatchObject({ name: 'Sugar', brands: [] });
  });
});

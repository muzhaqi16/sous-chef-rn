/**
 * Two shapes the installed Apollo produces that no type shows, each read by a
 * guard here:
 *
 * - A `cache.modify` modifier's `storeFieldName` is `field:{...}` for an array
 *   `keyArgs` and `field({...})` for none, and Apollo exports no parser, so
 *   `parseStoreFieldArgs` (`../cacheUpdaters.ts`) splits on whichever comes
 *   first.
 * - A `returnPartialData` read OMITS a field it cannot satisfy, so a presence
 *   check tests the key (`writeLocalEntity.ts`), never `!== undefined`.
 *
 * Verified: #apollo-storefieldname-has-two-serialized-forms
 */
import { gql } from '@apollo/client';
import * as utilities from '@apollo/client/utilities';
import { makeCache } from '#/apollo/cache';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

const LOCATIONS = gql`
  query ShapeProbeLocations($homeId: String!) {
    probeLocations(homeId: $homeId) {
      id
    }
  }
`;

const THINGS = gql`
  query ShapeProbeThings($filters: ShapeProbeFilters) {
    probeThings(filters: $filters) {
      id
    }
  }
`;

const NARROW = gql`
  fragment ShapeProbeNarrow on ShapeProbeItem {
    id
    categories {
      category {
        id
        name
      }
    }
  }
`;

const WIDE = gql`
  fragment ShapeProbeWide on ShapeProbeItem {
    id
    categories {
      isPrimary
      category {
        id
        name
      }
    }
  }
`;

type WideRow = {
  id: string;
  categories: {
    isPrimary: boolean;
    category: { id: string; name: string };
  }[];
};

describe("a cache.modify modifier's storeFieldName", () => {
  it('is the colon form for an array keyArgs and the paren form for none', () => {
    const cache = makeCache();
    cache.policies.addTypePolicies({
      Query: { fields: { probeLocations: { keyArgs: ['homeId'] } } },
    });
    for (const homeId of ['A', 'B']) {
      seedQuery(cache, {
        query: LOCATIONS,
        variables: { homeId },
        data: {
          probeLocations: [
            { __typename: 'ShapeProbeLocation', id: `loc-${homeId}` },
          ],
        },
      });
    }
    seedQuery(cache, {
      query: THINGS,
      variables: { filters: { category: 'x' } },
      data: { probeThings: [{ __typename: 'ShapeProbeThing', id: 't1' }] },
    });

    const observed: string[] = [];
    cache.modify({
      fields: {
        probeLocations(existing, { storeFieldName }) {
          observed.push(storeFieldName);
          return existing;
        },
        probeThings(existing, { storeFieldName }) {
          observed.push(storeFieldName);
          return existing;
        },
      },
    });

    expect(new Set(observed)).toEqual(
      new Set([
        'probeLocations:{"homeId":"A"}',
        'probeLocations:{"homeId":"B"}',
        'probeThings({"filters":{"category":"x"}})',
      ]),
    );
  });

  it('has no Apollo export that parses its arguments', () => {
    const parsers = [
      'fieldNameFromStoreName',
      'argumentsObjectFromField',
      'storeKeyNameFromField',
    ].filter(name => name in utilities);

    expect(parsers).toEqual([]);
  });
});

describe('a returnPartialData read of a row cached by a narrower selection', () => {
  it('omits the field it cannot satisfy rather than holding undefined', () => {
    const cache = makeCache();
    seedFragment(cache, {
      id: 'ShapeProbeItem:x',
      fragment: NARROW,
      data: {
        __typename: 'ShapeProbeItem',
        id: 'x',
        categories: [
          {
            __typename: 'ShapeProbeCategoryLink',
            category: {
              __typename: 'ShapeProbeCategory',
              id: 'c1',
              name: 'Dairy',
            },
          },
        ],
      },
    });

    const strict = cache.readFragment<WideRow>({
      id: 'ShapeProbeItem:x',
      fragment: WIDE,
    });
    const partial = cache.readFragment<WideRow>({
      id: 'ShapeProbeItem:x',
      fragment: WIDE,
      returnPartialData: true,
    });
    const link = partial?.categories[0];

    expect(strict).toBeNull();
    expect(link).toHaveProperty('category');
    expect(link && 'isPrimary' in link).toBe(false);
  });
});

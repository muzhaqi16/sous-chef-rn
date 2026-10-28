import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';

/**
 * Only the detail reads a breakdown's `perUnit` and `total`. Every list and
 * subscription writes the breakdown without them, so without the type policy
 * each such write would strip them and the open detail's read go incomplete.
 */

const DETAIL = gql`
  fragment BreakdownDetail on PantryItem {
    id
    packageBreakdown {
      count
      perUnitNetWeight
      perUnit {
        value
        unitId
      }
      total {
        value
        unitId
      }
    }
  }
`;

const LISTED = gql`
  fragment BreakdownListed on PantryItem {
    id
    packageBreakdown {
      count
      perUnitNetWeight
    }
  }
`;

const ID = 'PantryItem:p1';

interface Read {
  packageBreakdown: unknown;
}

describe('a pantry stack’s package breakdown', () => {
  it('keeps the detail’s readings through a list’s narrower write', () => {
    const cache = makeCache();
    cache.writeFragment({
      id: ID,
      fragment: DETAIL,
      data: {
        __typename: 'PantryItem',
        id: 'p1',
        packageBreakdown: {
          __typename: 'PackageBreakdown',
          count: 12,
          perUnitNetWeight: 340.19,
          perUnit: { __typename: 'Measure', value: 340.19, unitId: 'unit-g' },
          total: { __typename: 'Measure', value: 4082.28, unitId: 'unit-g' },
        },
      },
    });

    cache.writeFragment({
      id: ID,
      fragment: LISTED,
      data: {
        __typename: 'PantryItem',
        id: 'p1',
        packageBreakdown: {
          __typename: 'PackageBreakdown',
          count: 11,
          perUnitNetWeight: 340.19,
        },
      },
    });

    expect(
      cache.readFragment<Read>({ id: ID, fragment: DETAIL })?.packageBreakdown,
    ).toEqual(
      expect.objectContaining({
        count: 11,
        perUnit: expect.objectContaining({ value: 340.19 }),
        total: expect.objectContaining({ value: 4082.28 }),
      }),
    );
  });

  it('still goes away when the stack stops being packaged', () => {
    const cache = makeCache();
    cache.writeFragment({
      id: ID,
      fragment: LISTED,
      data: {
        __typename: 'PantryItem',
        id: 'p1',
        packageBreakdown: {
          __typename: 'PackageBreakdown',
          count: 12,
          perUnitNetWeight: 340.19,
        },
      },
    });

    cache.writeFragment({
      id: ID,
      fragment: LISTED,
      data: { __typename: 'PantryItem', id: 'p1', packageBreakdown: null },
    });

    expect(
      cache.readFragment<Read>({ id: ID, fragment: LISTED })?.packageBreakdown,
    ).toBeNull();
  });
});

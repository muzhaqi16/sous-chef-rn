import type { FragmentType } from '@apollo/client/masking';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';
import type { SortableItem_ItemFragmentDoc } from '#features/shoppingList/components/SortableShoppingList/SortableItem.generated';
import { aisleAfter, groupByAisle, linesInAisle } from '../aisles';

const line = (id: string, storeDepartment: string): ShoppingListRowItem => ({
  id,
  isPurchased: false,
  sortOrder: id,
  // A department this build was compiled without arrives as a plain string.
  storeDepartment: storeDepartment as StoreDepartment,
  itemRef: { __typename: 'ShoppingListItem', id } as FragmentType<
    typeof SortableItem_ItemFragmentDoc
  >,
});

const ids = (entries: ReturnType<typeof groupByAisle>) =>
  entries.map(entry => entry.id);

describe('groupByAisle', () => {
  const milk = line('milk', StoreDepartment.DairyEggs);
  const apples = line('apples', StoreDepartment.Produce);
  const soap = line('soap', StoreDepartment.Other);
  const peas = line('peas', StoreDepartment.Frozen);
  const yogurt = line('yogurt', StoreDepartment.DairyEggs);

  it("puts each aisle's lines under its heading, in the route's walk", () => {
    const grouped = groupByAisle(
      [milk, apples, yogurt],
      [StoreDepartment.Produce, StoreDepartment.DairyEggs],
    );

    expect(ids(grouped)).toEqual([
      'aisle:PRODUCE',
      'apples',
      'aisle:DAIRY_EGGS',
      'milk',
      'yogurt',
    ]);
    expect(grouped[2]).toMatchObject({ count: 2 });
  });

  // Offline with no cached route, or a route naming fewer aisles than the list.
  it('follows the route with the aisles it leaves out, in list order, OTHER last', () => {
    const grouped = groupByAisle(
      [soap, peas, milk, apples],
      [StoreDepartment.DairyEggs],
    );

    expect(ids(grouped)).toEqual([
      'aisle:DAIRY_EGGS',
      'milk',
      'aisle:FROZEN',
      'peas',
      'aisle:PRODUCE',
      'apples',
      'aisle:OTHER',
      'soap',
    ]);
  });

  it('places OTHER where the route walks it', () => {
    const grouped = groupByAisle(
      [milk, soap],
      [StoreDepartment.Other, StoreDepartment.DairyEggs],
    );

    expect(ids(grouped)).toEqual([
      'aisle:OTHER',
      'soap',
      'aisle:DAIRY_EGGS',
      'milk',
    ]);
  });

  it('reads a department, or a route stop, this build does not know as OTHER', () => {
    const grouped = groupByAisle(
      [line('wipes', 'HARDWARE'), milk],
      ['HARDWARE', StoreDepartment.DairyEggs],
    );

    expect(ids(grouped)).toEqual([
      'aisle:DAIRY_EGGS',
      'milk',
      'aisle:OTHER',
      'wipes',
    ]);
  });

  // FlashList re-renders every cell whose item changes identity.
  it('hands back the same entries for the same lines and route', () => {
    const rows = [milk, apples];
    const route = [StoreDepartment.Produce];

    expect(groupByAisle(rows, route)).toBe(groupByAisle(rows, route));
    expect(groupByAisle(rows, route)).not.toBe(groupByAisle(rows, null));
  });
});

describe('linesInAisle', () => {
  const milk = line('milk', StoreDepartment.DairyEggs);
  const apples = line('apples', StoreDepartment.Produce);
  const yogurt = line('yogurt', StoreDepartment.DairyEggs);
  const grouped = groupByAisle(
    [milk, apples, yogurt],
    [StoreDepartment.Produce, StoreDepartment.DairyEggs],
  );

  it("hands back one aisle's lines without its heading", () => {
    expect(linesInAisle(grouped, StoreDepartment.DairyEggs)).toEqual([
      milk,
      yogurt,
    ]);
    expect(linesInAisle(grouped, StoreDepartment.Frozen)).toEqual([]);
  });

  it('hands back the same lines for the same list and aisle', () => {
    expect(linesInAisle(grouped, StoreDepartment.Produce)).toBe(
      linesInAisle(grouped, StoreDepartment.Produce),
    );
  });
});

describe('aisleAfter', () => {
  const walk = [
    StoreDepartment.Produce,
    StoreDepartment.Bakery,
    StoreDepartment.DairyEggs,
    StoreDepartment.Frozen,
  ];

  it('goes on to the next aisle on the walk that still holds lines', () => {
    expect(
      aisleAfter(walk, StoreDepartment.Bakery, [
        StoreDepartment.Produce,
        StoreDepartment.Frozen,
      ]),
    ).toBe(StoreDepartment.Frozen);
  });

  // An aisle skipped earlier on the walk is not lost behind the last one.
  it('shows every aisle once the walk has nothing further', () => {
    expect(
      aisleAfter(walk, StoreDepartment.Frozen, [StoreDepartment.Produce]),
    ).toBe('all');
  });
});

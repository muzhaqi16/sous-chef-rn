import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { GetPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { writeLocalPantryItem } from '../writeLocalPantryItem';

/**
 * A local row fills in what the create cannot know and never what the device
 * already holds. A catalog `Item` is usually cached by a narrower query, so the
 * judgement is per field: a whole-entity read is null for a partial entity
 * exactly as for a missing one.
 */

type Cache = ReturnType<typeof makeCache>;

/** What `ItemByLookup` leaves after a scan: no images, no nutrition. */
const SCANNED_ITEM = gql`
  fragment ScannedItem on Item {
    id
    name
    imageUrl
    shelfLifeDays
    shelfLifeOpenedDays
  }
`;

/** What `CreateItem` leaves: `categories` without `isPrimary`. */
const CREATED_ITEM = gql`
  fragment CreatedItem on Item {
    id
    name
    shelfLifeDays
    categories {
      category {
        id
        name
      }
    }
  }
`;

const detail = (cache: Cache, id: string) =>
  cache.diff<{
    pantryItem: {
      costPerUnit: number | null;
      totalCost: number | null;
      unit: { id: string };
      item: {
        name: string;
        imageUrl: string | null;
        shelfLifeDays: number | null;
        shelfLifeOpenedDays: number | null;
        categories: unknown[];
      };
    } | null;
  }>({
    query: GetPantryItemDocument,
    variables: { id },
    optimistic: false,
    returnPartialData: true,
  });

describe('writeLocalPantryItem', () => {
  it('keeps the catalog fields a narrower query cached', () => {
    const cache = makeCache();
    cache.writeFragment({
      fragment: SCANNED_ITEM,
      data: {
        __typename: 'Item',
        id: 'item-1',
        name: 'Organic Whole Milk',
        imageUrl: 'https://cdn.example.com/milk.jpg',
        shelfLifeDays: 14,
        shelfLifeOpenedDays: 5,
      },
    });

    writeLocalPantryItem(cache, 'row-1', {
      pantryId: 'pantry-1',
      itemName: 'Milk',
      itemId: 'item-1',
    });

    const read = detail(cache, 'row-1');
    expect(read.complete).toBe(true);
    expect(read.result?.pantryItem?.item).toMatchObject({
      // The catalog's own name, not the typed one.
      name: 'Organic Whole Milk',
      imageUrl: 'https://cdn.example.com/milk.jpg',
      shelfLifeDays: 14,
      shelfLifeOpenedDays: 5,
    });
  });

  it('completes a nested value the cache holds only in part', () => {
    const cache = makeCache();
    cache.writeFragment({
      fragment: CREATED_ITEM,
      data: {
        __typename: 'Item',
        id: 'item-2',
        name: 'Milk',
        shelfLifeDays: 14,
        categories: [
          {
            __typename: 'ItemCategoryLink',
            category: { __typename: 'Category', id: 'cat-1', name: 'Dairy' },
          },
        ],
      },
    });

    writeLocalPantryItem(cache, 'row-2', {
      pantryId: 'pantry-1',
      itemName: 'Milk',
      itemId: 'item-2',
    });

    // Written back as held, the partial list would leave every read of the
    // entity incomplete; its complete sibling survives.
    const read = detail(cache, 'row-2');
    expect(read.complete).toBe(true);
    expect(read.result?.pantryItem?.item?.shelfLifeDays).toBe(14);
    expect(read.result?.pantryItem?.item?.categories).toEqual([]);
  });

  it('keeps a null the server supplied', () => {
    const cache = makeCache();
    cache.writeFragment({
      fragment: gql`
        fragment NullShelfLife on Item {
          id
          shelfLifeDays
          shelfLifeOpenedDays
        }
      `,
      data: {
        __typename: 'Item',
        id: 'item-3',
        shelfLifeDays: null,
        shelfLifeOpenedDays: 9,
      },
    });

    writeLocalPantryItem(cache, 'row-3', {
      pantryId: 'pantry-1',
      itemName: 'Salt',
      itemId: 'item-3',
    });

    expect(detail(cache, 'row-3').result?.pantryItem?.item).toMatchObject({
      shelfLifeDays: null,
      shelfLifeOpenedDays: 9,
    });
  });

  it('names a free-text row with what was typed', () => {
    const cache = makeCache();

    writeLocalPantryItem(cache, 'row-4', {
      pantryId: 'pantry-1',
      itemName: 'Loose tea',
    });

    const read = detail(cache, 'row-4');
    expect(read.complete).toBe(true);
    expect(read.result?.pantryItem?.item?.name).toBe('Loose tea');
    // Retained until a removal releases it, so a gc cannot take a queued
    // create that no list links yet.
    cache.gc();
    expect(cache.extract()['PantryItem:row-4']).toBeDefined();
  });

  it('prices the row from the per-unit cost and the quantity', () => {
    const cache = makeCache();

    writeLocalPantryItem(cache, 'row-5', {
      pantryId: 'pantry-1',
      itemName: 'Green onions',
      costPerUnit: 0.59,
      quantity: 5,
    });
    writeLocalPantryItem(cache, 'row-6', {
      pantryId: 'pantry-1',
      itemName: 'Green onions',
      quantity: 5,
    });

    // Unrounded, as the server stores it.
    expect(detail(cache, 'row-5').result?.pantryItem?.totalCost).toBeCloseTo(
      2.95,
      10,
    );
    expect(detail(cache, 'row-6').result?.pantryItem).toMatchObject({
      costPerUnit: null,
      totalCost: null,
    });
  });

  it('counts in the stated unit and guesses none', () => {
    const cache = makeCache();

    writeLocalPantryItem(cache, 'row-7', {
      pantryId: 'pantry-1',
      itemName: 'Flour',
      unitId: 'unit-g',
    });
    writeLocalPantryItem(cache, 'row-8', {
      pantryId: 'pantry-1',
      itemName: 'Flour',
    });

    expect(detail(cache, 'row-7').result?.pantryItem?.unit?.id).toBe('unit-g');
    // No stated unit: the neutral stand-in, never the catalog's display unit,
    // which a replay would send as a choice the server did not make.
    expect(detail(cache, 'row-8').result?.pantryItem?.unit?.id).toBe('');
  });
});

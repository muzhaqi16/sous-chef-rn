import { makeCache } from '#/apollo/cache';
import { writePantryItemDetailStub } from '../writePantryItemDetailStub';
import {
  WritePantryItemDetailStub_ItemMediaFragmentDoc,
  WritePantryItemDetailStub_ItemCatalogFragmentDoc,
} from '../writePantryItemDetailStub.generated';

/**
 * The stub fills in what a locally created pantry item cannot know. It must
 * never fill in what is already known.
 *
 * The hazard is that `readFragment` is all-or-nothing: it returns null for a
 * PARTIALLY cached entity exactly as for an absent one. Grouping the fragments
 * narrows the blast radius but does not remove it — a group is still defaulted
 * whole when one of its fields is missing.
 */

/**
 * The shape `ItemByUpcFilter` normalizes after a barcode scan: real catalog
 * values for `imageUrl`, `shelfLifeDays`, `shelfLifeOpenedDays` and
 * `categories`, but no `images` and no `nutritions`.
 */
function seedScannedItem(cache: ReturnType<typeof makeCache>, id: string) {
  cache.writeFragment({
    id: `Item:${id}`,
    fragment: gqlPartialItem,
    data: {
      __typename: 'Item',
      id,
      name: 'Organic Whole Milk',
      imageUrl: 'https://cdn.example.com/milk.jpg',
      shelfLifeDays: 14,
      shelfLifeOpenedDays: 5,
      categories: [
        {
          __typename: 'ItemCategoryLink',
          isPrimary: true,
          category: { __typename: 'Category', id: 'cat-1', name: 'Dairy' },
        },
      ],
    },
  });
}

const { gql } = require('@apollo/client');
const gqlPartialItem = gql`
  fragment PartialScannedItem on Item {
    id
    name
    imageUrl
    shelfLifeDays
    shelfLifeOpenedDays
    categories {
      isPrimary
      category {
        id
        name
      }
    }
  }
`;

describe('writePantryItemDetailStub', () => {
  it('does not clobber catalog fields already cached by a narrower query', () => {
    const cache = makeCache();
    const itemId = 'item-scanned-1';
    seedScannedItem(cache, itemId);

    writePantryItemDetailStub(cache, 'pantry-item-local-1', {
      itemId,
      itemName: 'Organic Whole Milk',
    });

    // No explicit type argument: the generated doc carries the fragment's type.
    const media = cache.readFragment({
      id: `Item:${itemId}`,
      fragment: WritePantryItemDetailStub_ItemMediaFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_itemMedia',
      returnPartialData: true,
    });
    // The image the scan resolved must survive. `images` was absent from the
    // scan's selection, so the group read failed and the neutral default
    // overwrote BOTH fields.
    expect(media?.imageUrl).toBe('https://cdn.example.com/milk.jpg');

    const catalog = cache.readFragment({
      id: `Item:${itemId}`,
      fragment: WritePantryItemDetailStub_ItemCatalogFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_itemCatalog',
      returnPartialData: true,
    });
    expect(catalog?.shelfLifeDays).toBe(14);
    expect(catalog?.shelfLifeOpenedDays).toBe(5);
    expect(catalog?.categories).toHaveLength(1);
  });

  it('still supplies neutral values for an item the cache has never seen', () => {
    const cache = makeCache();
    const itemId = 'item-brand-new';

    writePantryItemDetailStub(cache, 'pantry-item-local-2', {
      itemId,
      itemName: 'Hand-typed item',
    });

    const catalog = cache.readFragment({
      id: `Item:${itemId}`,
      fragment: WritePantryItemDetailStub_ItemCatalogFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_itemCatalog',
    });
    // A genuinely unknown item still gets a complete, neutral group — that is
    // what keeps the detail screen from dead-ending offline.
    expect(catalog).not.toBeNull();
    expect(catalog?.categories).toEqual([]);
  });
});

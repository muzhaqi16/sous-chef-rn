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

/**
 * The shape `mutation CreateItem` normalizes: `categories` WITHOUT `isPrimary`.
 * The nested link therefore has the key absent, not undefined — see
 * `docs/verified-library-behaviour.md#apollo-partial-reads-omit-missing-keys-rather-than-undefining-them`.
 */
const gqlCreateItemShape = gql`
  fragment CreateItemShape on Item {
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

const gqlNullShelfLife = gql`
  fragment NullShelfLife on Item {
    id
    shelfLifeDays
    shelfLifeOpenedDays
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

  it('completes the catalog group when a nested value was cached partially', () => {
    const cache = makeCache();
    const itemId = 'item-created-1';

    // The selection `mutation CreateItem` really uses: `categories { category
    // { id name } }`, with NO `isPrimary`. Every free-text and barcode pantry
    // add that mints a catalog Item leaves the entity in exactly this state.
    cache.writeFragment({
      id: `Item:${itemId}`,
      fragment: gqlCreateItemShape,
      data: {
        __typename: 'Item',
        id: itemId,
        name: 'Milk',
        // A COMPLETE sibling scalar, to prove completeness is judged per field
        // rather than per group.
        shelfLifeDays: 14,
        categories: [
          {
            __typename: 'ItemCategoryLink',
            category: { __typename: 'Category', id: 'cat-1', name: 'Dairy' },
          },
        ],
      },
    });

    writePantryItemDetailStub(cache, 'pantry-item-local-3', {
      itemId,
      itemName: 'Milk',
    });

    // The STRICT read — the one `GetPantryItem` performs. A partially cached
    // `categories` written straight back leaves this null, and with
    // `returnPartialData: false` the detail screen then goes to the network for
    // an id the server does not have. Offline it blanks.
    const catalog = cache.readFragment({
      id: `Item:${itemId}`,
      fragment: WritePantryItemDetailStub_ItemCatalogFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_itemCatalog',
    });
    expect(catalog).not.toBeNull();

    // The complete sibling survives — that is the preservation rule doing its
    // job at field granularity.
    expect(catalog?.shelfLifeDays).toBe(14);
    // The INCOMPLETE nested value yields to the neutral. It is the one value
    // that cannot be written back, so the choice is between completing the read
    // and keeping a shape that makes every read of this entity fail. See the
    // trade recorded on `completeFields`.
    expect(catalog?.categories).toEqual([]);
  });

  it('keeps a genuinely null cached value rather than treating it as absent', () => {
    const cache = makeCache();
    const itemId = 'item-null-shelf-life';

    // `shelfLifeDays: null` is a value the server supplied, not a hole.
    cache.writeFragment({
      id: `Item:${itemId}`,
      fragment: gqlNullShelfLife,
      data: {
        __typename: 'Item',
        id: itemId,
        shelfLifeDays: null,
        shelfLifeOpenedDays: 9,
      },
    });

    writePantryItemDetailStub(cache, 'pantry-item-local-4', {
      itemId,
      itemName: 'Salt',
    });

    const catalog = cache.readFragment({
      id: `Item:${itemId}`,
      fragment: WritePantryItemDetailStub_ItemCatalogFragmentDoc,
      fragmentName: 'writePantryItemDetailStub_itemCatalog',
    });
    expect(catalog).not.toBeNull();
    expect(catalog?.shelfLifeDays).toBeNull();
    expect(catalog?.shelfLifeOpenedDays).toBe(9);
  });

  it.each([
    ['a free-text create (no catalog id)', undefined],
    ['a barcode create (catalog id minted by CreateItem)', 'item-scanned-new'],
  ])(
    'leaves GetPantryItem readable after %s',
    (_label, itemId: string | undefined) => {
      const cache = makeCache();
      const pantryItemId = 'pantry-item-local-5';

      if (itemId) {
        // The create response's own selection — the state the entity is left in
        // when the server mints a new catalog Item for a scan.
        cache.writeFragment({
          id: `Item:${itemId}`,
          fragment: gqlCreateItemShape,
          data: {
            __typename: 'Item',
            id: itemId,
            name: 'Scanned Item',
            shelfLifeDays: null,
            categories: [
              {
                __typename: 'ItemCategoryLink',
                category: {
                  __typename: 'Category',
                  id: 'cat-2',
                  name: 'Pantry',
                },
              },
            ],
          },
        });
      }

      writePantryItemDetailStub(cache, pantryItemId, {
        itemId,
        itemName: 'Scanned Item',
      });

      // Every catalog group the detail screen reads must resolve strictly. One
      // group short and `GetPantryItem` returns nothing and goes to the network
      // for an id the server does not have.
      const resolvedItemId = itemId ?? `local-item-${pantryItemId}`;
      for (const [fragment, fragmentName] of [
        [
          WritePantryItemDetailStub_ItemCatalogFragmentDoc,
          'writePantryItemDetailStub_itemCatalog',
        ],
        [
          WritePantryItemDetailStub_ItemMediaFragmentDoc,
          'writePantryItemDetailStub_itemMedia',
        ],
      ] as const) {
        expect(
          cache.readFragment({
            id: `Item:${resolvedItemId}`,
            fragment,
            fragmentName,
          }),
        ).not.toBeNull();
      }
    },
  );

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

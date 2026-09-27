/**
 * Test fixture builders that match the production GraphQL document selection
 * for `GetPantry`. Use with `cache.writeQuery({ query: GetPantryDocument, ... })`
 * to seed the cache without losing fields to selection-set mismatches.
 *
 * Production code reads `normalizePantry(pantry).items`, but the document
 * selects `pantry.itemsConnection.edges.node`. The fixture emits the Connection
 * shape so the real `normalizePantry` runs end-to-end in tests.
 */

import type { Unmasked } from '@apollo/client/masking';
import {
  StorageState,
  StorageType,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import type { GetPantryQuery } from '#features/pantry/graphql/pantry.generated';

// The document's own shapes. Annotating a builder with one narrows every
// `__typename` inside it, and fails the build when the selection gains a field
// the fixture does not supply.
type Pantry = NonNullable<Unmasked<GetPantryQuery>['pantry']>;
type PantryItemNode = Pantry['itemsConnection']['edges'][number]['node'];
type StorageLocationNode =
  Pantry['storageLocationsConnection']['edges'][number]['node'];
type PageInfo = Pantry['itemsConnection']['pageInfo'];

const pageInfo = (): PageInfo => ({
  __typename: 'PageInfo',
  hasNextPage: false,
  endCursor: null,
});

export interface PantryItemFixture {
  id: string;
  itemName?: string;
  quantity?: number;
  heldQuantity?: number;
}

export interface StorageLocationFixture {
  id: string;
  name?: string;
  type?: StorageType;
  temperature?: StorageState | null;
}

export interface PantryFixture {
  id: string;
  homeId?: string;
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  version?: number;
  items?: PantryItemFixture[];
  storageLocations?: StorageLocationFixture[];
  totalItems?: number;
}

// Generic over the literal typename strings so the inferred return preserves
// `__typename: 'PantryItemConnection'` (etc.) rather than widening to `string`,
// which lets the builders below satisfy the generated query types.
function connection<TN extends string, ET extends string, T>(
  typename: TN,
  edgeTypename: ET,
  nodes: T[],
  totalCount?: number,
) {
  return {
    __typename: typename,
    edges: nodes.map((node, i) => ({
      __typename: edgeTypename,
      cursor: `c${i}`,
      node,
    })),
    pageInfo: pageInfo(),
    totalCount: totalCount ?? nodes.length,
  };
}

/** Build a single PantryItem node matching PantryItemDisplay fragment selection. */
function pantryItemNode(item: PantryItemFixture): PantryItemNode {
  return {
    __typename: 'PantryItem',
    id: item.id,
    itemId: `item-${item.id}`,
    itemName: item.itemName ?? `Item ${item.id}`,
    quantity: item.quantity ?? 1,
    heldQuantity: item.heldQuantity ?? item.quantity ?? 1,
    // Shown in the unit it counts in, as the server shows a stack of pieces.
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity: item.heldQuantity ?? item.quantity ?? 1,
      unit: { __typename: 'Unit', id: 'unit-piece', symbol: 'pc' },
    },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    storageState: StorageState.Ambient,
    expiresOn: null,
    isLowStock: false,
    lastUsedAt: null,
    netWeight: null,
    remainingNetWeight: null,
    portionUnitId: null,
    portionUnit: null,
    remainingPortions: null,
    activeBatchCount: 0,
    item: {
      __typename: 'Item',
      id: `item-${item.id}`,
      imageUrl: null,
      images: [],
    },
    unit: {
      __typename: 'Unit',
      id: 'unit-piece',
      name: 'piece',
      symbol: 'pc',
      type: UnitType.Count,
      displayAsFraction: false,
    },
    netWeightUnit: null,
    storageLocation: null,
    packageBreakdown: null,
    quantityBreakdown: null,
  };
}

function storageLocationNode(loc: StorageLocationFixture): StorageLocationNode {
  return {
    __typename: 'StorageLocation',
    id: loc.id,
    name: loc.name ?? `Location ${loc.id}`,
    type: loc.type ?? StorageType.PantryShelf,
    icon: null,
    color: null,
    temperature: loc.temperature ?? null,
    isDefault: false,
    currentItemCount: 0,
    parentLocation: null,
  };
}

/**
 * Build the full `GetPantry` query result. Pass to
 * `cache.writeQuery({ query: GetPantryDocument, variables: { id }, data: ... })`.
 */
export function pantryData(pantry: PantryFixture): Unmasked<GetPantryQuery> {
  const items = pantry.items ?? [];
  const storageLocations = pantry.storageLocations ?? [];
  return {
    __typename: 'Query',
    pantry: {
      __typename: 'Pantry',
      id: pantry.id,
      homeId: pantry.homeId ?? 'h1',
      name: pantry.name ?? `Pantry ${pantry.id}`,
      description: pantry.description ?? null,
      isDefault: pantry.isDefault ?? false,
      version: pantry.version ?? 1,
      stats: {
        __typename: 'PantryStats',
        totalItems: pantry.totalItems ?? items.length,
        expiringCount: 0,
        expiredCount: 0,
        lowStockCount: 0,
        storageStateCounts: {
          __typename: 'StorageStateCounts',
          refrigerated: 0,
          frozen: 0,
          ambient: items.length,
          none: 0,
        },
        storageLocationCounts: [],
      },
      itemsConnection: connection(
        'PantryItemConnection',
        'PantryItemEdge',
        items.map(pantryItemNode),
        pantry.totalItems ?? items.length,
      ),
      storageLocationsConnection: connection(
        'StorageLocationConnection',
        'StorageLocationEdge',
        storageLocations.map(storageLocationNode),
      ),
    },
  };
}

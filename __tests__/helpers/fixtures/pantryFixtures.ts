/**
 * Test fixture builders that match the production GraphQL document selection
 * for `GetPantry`. Use with `cache.writeQuery({ query: GetPantryDocument, ... })`
 * to seed the cache without losing fields to selection-set mismatches.
 *
 * Production code reads `normalizePantry(pantry).items`, but the document
 * selects `pantry.itemsConnection.edges.node`. The fixture emits the Connection
 * shape so the real `normalizePantry` runs end-to-end in tests.
 */

export interface PantryItemFixture {
  id: string;
  itemName?: string;
  quantity?: number;
}

export interface StorageLocationFixture {
  id: string;
  name?: string;
  type?: string;
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

interface ConnectionData<T> {
  __typename: string;
  edges: Array<{ __typename: string; cursor: string; node: T }>;
  pageInfo: { __typename: 'PageInfo'; hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}

function connection<T>(
  typename: string,
  edgeTypename: string,
  nodes: T[],
  totalCount?: number,
): ConnectionData<T> {
  return {
    __typename: typename,
    edges: nodes.map((node, i) => ({
      __typename: edgeTypename,
      cursor: `c${i}`,
      node,
    })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage: false,
      endCursor: null,
    },
    totalCount: totalCount ?? nodes.length,
  };
}

/** Build a single PantryItem node matching PantryItemDisplay fragment selection. */
function pantryItemNode(item: PantryItemFixture) {
  return {
    __typename: 'PantryItem',
    id: item.id,
    pantryId: 'p1',
    itemId: null,
    itemName: item.itemName ?? `Item ${item.id}`,
    quantity: item.quantity ?? 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    storageState: 'AMBIENT',
    expiresAt: null,
    lowStockAlert: false,
    isLowStock: false,
    minQuantity: null,
    lastUsedAt: null,
    netWeight: null,
    remainingNetWeight: null,
    activeBatchCount: 0,
    earliestBatchExpiration: null,
    item: null,
    unit: null,
    netWeightUnit: null,
    storageLocation: null,
    packageBreakdown: null,
    quantityBreakdown: null,
  };
}

function storageLocationNode(loc: StorageLocationFixture) {
  return {
    __typename: 'StorageLocation',
    id: loc.id,
    name: loc.name ?? `Location ${loc.id}`,
    type: loc.type ?? 'PANTRY',
    icon: null,
    color: null,
    isDefault: false,
    currentItemCount: 0,
    parentLocation: null,
  };
}

/**
 * Build the full `GetPantry` query result. Pass to
 * `cache.writeQuery({ query: GetPantryDocument, variables: { id }, data: ... })`.
 */
export function pantryData(pantry: PantryFixture) {
  const items = pantry.items ?? [];
  const storageLocations = pantry.storageLocations ?? [];
  return {
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
        lowStockCount: 0,
        storageStateCounts: {
          __typename: 'StorageStateCounts',
          refrigerated: 0,
          frozen: 0,
          ambient: items.length,
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

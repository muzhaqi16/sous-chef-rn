/**
 * Test fixture builders matching the production `PantryItemDetail_pantryItem`
 * fragment selected by `GetPantryItem`. Use with
 * `recordMock(GetPantryItemDocument, { data: pantryItemData(...) })`.
 *
 * Defaults emit nullable fields as null; override the few needed for
 * each test.
 */
import type { Unmasked } from '@apollo/client/masking';
import type { GetPantryItemQuery } from '#features/pantry/graphql/pantry.generated';
import {
  StorageState,
  StorageType,
  ItemCondition,
  AcquisitionMethod,
  UnitType,
} from '#/graphql/generated/schemaTypes';

// Test fixtures need the fully unmasked shape so they can specify nested
// fragment fields directly when seeding the cache.
type UnmaskedGetPantryItemQuery = Unmasked<GetPantryItemQuery>;
type PantryItemNode = NonNullable<UnmaskedGetPantryItemQuery['pantryItem']>;
type UnitData = PantryItemNode['unit'];

export interface PantryItemFixture {
  id?: string;
  itemName?: string;
  quantity?: number;
  storageState?: string;
  expiresAt?: string | null;
  createdAt?: string;
  brandName?: string | null;
  categoryName?: string | null;
  storageNotes?: string | null;
  tags?: string[];
  condition?: string;
  acquisitionMethod?: string;
  storageLocationName?: string | null;
  unitName?: string;
  unitSymbol?: string;
}

function unit(symbol = 'L', name = 'liters'): UnitData {
  return {
    __typename: 'Unit',
    id: 'u1',
    name,
    symbol,
    type: UnitType.Volume,
    isMetric: true,
    baseUnitId: 'u1',
    conversionFactor: 1,
    isCommon: true,
    displayAsFraction: false,
    minPrecision: 2,
    autoConvertThreshold: null,
  };
}

/** Build the full GetPantryItem query result. */
export function pantryItemData(
  fixture: PantryItemFixture = {},
): UnmaskedGetPantryItemQuery {
  const id = fixture.id ?? 'pi1';
  const tags = fixture.tags ?? [];
  const data: UnmaskedGetPantryItemQuery = {
    __typename: 'Query',
    pantryItem: {
      __typename: 'PantryItem',
      id,
      pantryId: 'p1',
      itemId: 'item1',
      itemName: fixture.itemName ?? 'Milk',
      quantity: fixture.quantity ?? 2,
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      storageState:
        (fixture.storageState as StorageState | undefined) ??
        StorageState.Refrigerated,
      expiresAt: fixture.expiresAt ?? null,
      lowStockAlert: false,
      isLowStock: false,
      minQuantity: null,
      lastUsedAt: null,
      netWeight: null,
      remainingNetWeight: null,
      activeBatchCount: 0,
      earliestBatchExpiration: null,
      item: {
        __typename: 'Item',
        id: 'item1',
        name: 'Milk',
        imageUrl: null,
        images: [],
        photos: [],
        shelfLifeDays: null,
        shelfLifeOpenedDays: null,
        nutritions: null,
        categories: fixture.categoryName
          ? [
              {
                __typename: 'ItemCategory',
                isPrimary: true,
                category: {
                  __typename: 'Category',
                  id: 'cat1',
                  name: fixture.categoryName,
                },
              },
            ]
          : [],
      },
      unit: unit(fixture.unitSymbol, fixture.unitName),
      netWeightUnit: null,
      storageLocation: fixture.storageLocationName
        ? {
            __typename: 'StorageLocation',
            id: 'loc1',
            name: fixture.storageLocationName,
            type: StorageType.PantryShelf,
          }
        : null,
      packageBreakdown: null,
      quantityBreakdown: null,
      brand: fixture.brandName
        ? { __typename: 'Brand', id: 'b1', name: fixture.brandName }
        : null,
      tags,
      storageNotes: fixture.storageNotes ?? null,
      createdAt: fixture.createdAt ?? '2026-01-01T00:00:00Z',
      restockQuantity: null,
      store: null,
      condition:
        (fixture.condition as ItemCondition | undefined) ?? ItemCondition.Good,
      acquisitionMethod:
        (fixture.acquisitionMethod as AcquisitionMethod | undefined) ??
        AcquisitionMethod.Purchased,
      costPerUnit: null,
      totalCost: null,
      purchase: null,
      usageRecords: {
        __typename: 'PantryItemUsageConnection',
        edges: [],
      },
    },
  };
  return data;
}

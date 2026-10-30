/**
 * Test fixture builders matching the production `PantryItemDetail_pantryItem`
 * fragment selected by `GetPantryItem`. Use with
 * `recordMock(GetPantryItemDocument, { data: pantryItemData(...) })`.
 *
 * Defaults emit nullable fields as null; override the few needed for
 * each test.
 */
import type { Unmasked } from '@apollo/client/masking';
import type { GetPantryItemQuery } from '#features/pantry/screens/usePantryItemDetailData.generated';
import {
  StorageState,
  StorageType,
  ItemCondition,
  AcquisitionMethod,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { asAbbreviation, readingAsAbbreviation } from './unitLabels';

// Test fixtures need the fully unmasked shape so they can specify nested
// fragment fields directly when seeding the cache.
type UnmaskedGetPantryItemQuery = Unmasked<GetPantryItemQuery>;
type PantryItemNode = NonNullable<UnmaskedGetPantryItemQuery['pantryItem']>;
type UnitData = PantryItemNode['unit'];
type NutritionFactsData = NonNullable<
  PantryItemNode['item']['shownNutrition']
>['facts'];

export interface PantryItemFixture {
  id?: string;
  itemName?: string;
  quantity?: number;
  heldQuantity?: number;
  storageState?: string;
  expiresOn?: string | null;
  earliestBatchExpiresOn?: string | null;
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
  unitDisplayAsFraction?: boolean;
  minQuantity?: number | null;
  restockQuantity?: number | null;
  /** The item's OWN cost fields — the first stock's, which a restock leaves be. */
  costPerUnit?: number | null;
  totalCost?: number | null;
  nutritionFacts?: NutritionFactsData;
  /** The concept the facts are typical of; absent, they are the item's own. */
  typicalOf?: string;
  /** A public catalog item (`canSuggest`), which can be reported. */
  canSuggest?: boolean;
  /** The catalog item's approved main photo. */
  imageUrl?: string | null;
  /** The photo the entry shows (`PantryItem.image`); none by default. */
  image?: PantryItemNode['image'];
  /** The catalog item's photos; none by default. */
  photos?: PantryItemNode['item']['photos'];
}

function unit(
  symbol = 'L',
  name = 'liters',
  displayAsFraction = false,
): UnitData {
  return asAbbreviation({
    __typename: 'Unit',
    id: 'u1',
    name,
    symbol,
    type: UnitType.Volume,
    displayAsFraction,
  });
}

type HeldReading = NonNullable<
  UnmaskedGetPantryItemQuery['pantryItem']
>['held']['metric'];

function heldReading(
  value: number,
  { id, symbol, displayAsFraction }: UnitData,
): HeldReading {
  return readingAsAbbreviation({
    __typename: 'MeasureReading',
    value,
    unitId: id,
    symbol,
    displayAsFraction,
    type: UnitType.Volume,
  });
}

/** Build the full GetPantryItem query result. */
export function pantryItemData(
  fixture: PantryItemFixture = {},
): UnmaskedGetPantryItemQuery {
  const id = fixture.id ?? 'pi1';
  const tags = fixture.tags ?? [];
  const trackingUnit = unit(
    fixture.unitSymbol,
    fixture.unitName,
    fixture.unitDisplayAsFraction,
  );
  const held = fixture.heldQuantity ?? fixture.quantity ?? 2;
  const data: UnmaskedGetPantryItemQuery = {
    __typename: 'Query',
    pantryItem: {
      __typename: 'PantryItem',
      id,
      pantryId: 'p1',
      itemId: 'item1',
      image: fixture.image ?? null,
      itemName: fixture.itemName ?? 'Milk',
      quantity: fixture.quantity ?? 2,
      heldQuantity: held,
      // Shown in the unit it counts in.
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity: held,
        localizedSymbol: trackingUnit.symbol,
        fraction: null,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: trackingUnit.id,
          symbol: trackingUnit.symbol,
        }),
      },
      // The same figure in both systems: what the screen showed before readings.
      held: {
        __typename: 'Measure',
        value: held,
        unitId: trackingUnit.id,
        metric: heldReading(held, trackingUnit),
        imperial: heldReading(held, trackingUnit),
      },
      costCurrency: null,
      version: 1,
      updatedAt: '2026-01-01',
      storageState:
        (fixture.storageState as StorageState | undefined) ??
        StorageState.Refrigerated,
      expiresOn: fixture.expiresOn ?? null,
      lowStockAlert: false,
      isLowStock: false,
      minQuantity: fixture.minQuantity ?? null,
      lastUsedAt: null,
      netWeight: null,
      remainingNetWeight: null,
      packageSize: null,
      remaining: null,
      portionUnitId: null,
      portionUnit: null,
      remainingPortions: null,
      activeBatchCount: 0,
      earliestBatchExpiresOn: fixture.earliestBatchExpiresOn ?? null,
      item: {
        __typename: 'Item',
        version: 1,
        id: 'item1',
        // Read-only by default: the photo viewer's "set as main" action is
        // gated on this, and a fixture that grants it would exercise a path
        // most callers of these fixtures never reach.
        canEdit: false,
        canSuggest: fixture.canSuggest ?? false,
        name: 'Milk',
        imageUrl: fixture.imageUrl ?? null,
        images: [],
        photos: fixture.photos ?? [],
        shelfLifeDays: null,
        shelfLifeOpenedDays: null,
        shownNutrition: fixture.nutritionFacts
          ? {
              __typename: 'ShownNutrition',
              facts: fixture.nutritionFacts,
              typicalOf: fixture.typicalOf
                ? {
                    __typename: 'Item',
                    version: 1,
                    id: 'concept-1',
                    name: fixture.typicalOf,
                  }
                : null,
            }
          : null,
        categories: fixture.categoryName
          ? [
              {
                __typename: 'ItemCategory',
                id: 'itemcat1',
                isPrimary: true,
                category: {
                  __typename: 'Category',
                  version: 1,
                  id: 'cat1',
                  name: fixture.categoryName,
                },
              },
            ]
          : [],
      },
      unit: trackingUnit,
      displayUnit: null,
      netWeightUnit: null,
      consumeUnit: null,
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
        ? { __typename: 'Brand', version: 1, id: 'b1', name: fixture.brandName }
        : null,
      tags,
      storageNotes: fixture.storageNotes ?? null,
      createdAt: fixture.createdAt ?? '2026-01-01',
      restockQuantity: fixture.restockQuantity ?? null,
      store: null,
      condition:
        (fixture.condition as ItemCondition | undefined) ?? ItemCondition.Good,
      acquisitionMethod:
        (fixture.acquisitionMethod as AcquisitionMethod | undefined) ??
        AcquisitionMethod.Purchased,
      costPerUnit: fixture.costPerUnit ?? null,
      totalCost: fixture.totalCost ?? null,
      purchase: null,
      usageRecordsConnection: {
        __typename: 'PantryItemUsageConnection',
        totalCount: 0,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        edges: [],
      },
    },
  };
  return data;
}

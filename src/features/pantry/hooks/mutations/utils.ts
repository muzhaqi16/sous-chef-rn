/**
 * Shared utilities for pantry item mutations
 */

import { type UseUpdatePantryItem_PantryItemFragment } from './useUpdatePantryItem.generated';
import {
  StorageState,
  UnitType,
  type UpdatePantryItemInput,
  type StorageDetailsInput,
  type InventoryThresholdsInput,
  type NetWeightInput,
} from '#/graphql/generated/schemaTypes';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import type { UnitSelection, FormDataInput } from './types';

// Cache updater for adding items to Pantry.itemsConnection
export const addToPantryItemsCache = createAddToParentConnectionUpdater<{
  id: string;
}>('Pantry', 'itemsConnection', 'PantryItem');

/**
 * Build optimistic Unit object for cache updates.
 * Includes all Unit fields to prevent cache warnings.
 */
export function buildOptimisticUnit(
  newUnit: UnitSelection,
  currentUnit?: UseUpdatePantryItem_PantryItemFragment['unit'] | null,
): UseUpdatePantryItem_PantryItemFragment['unit'] | null {
  if (!newUnit.id) return null;

  // Cast type to UnitType if it's a string, fallback to COUNT
  const unitType = (newUnit.type || currentUnit?.type || 'COUNT') as UnitType;

  return {
    __typename: 'Unit',
    id: newUnit.id,
    symbol: newUnit.symbol || currentUnit?.symbol || '',
    name: newUnit.name || currentUnit?.name || newUnit.symbol || '',
    type: unitType,
    // Preserve existing fields from current unit or use sensible defaults
    isMetric: currentUnit?.isMetric ?? false,
    baseUnitId: currentUnit?.baseUnitId ?? null,
    conversionFactor: currentUnit?.conversionFactor ?? 1,
    isCommon: currentUnit?.isCommon ?? false,
    displayAsFraction: currentUnit?.displayAsFraction ?? false,
    minPrecision: currentUnit?.minPrecision ?? 0,
    autoConvertThreshold: currentUnit?.autoConvertThreshold ?? null,
  };
}

/**
 * Build dirty input for update mutation (only changed fields)
 */
export function buildDirtyUpdateInput(
  data: FormDataInput,
  dirtyFields: Record<string, boolean>,
  locationId: string | null,
  brandId: string | null,
  unitSymbol?: string | null,
): Omit<UpdatePantryItemInput, 'id'> {
  const input: Omit<UpdatePantryItemInput, 'id'> = {};

  if (dirtyFields.itemName) {
    input.itemName = data.itemName;
  }

  // Group storage-related fields into storage: StorageDetailsInput
  const storage: StorageDetailsInput = {};
  if (dirtyFields.storageState) {
    storage.storageState = data.storageState;
  }
  if (dirtyFields.location && locationId) {
    storage.storageLocationId = locationId;
  }
  if (dirtyFields.notes) {
    storage.storageNotes = data.notes;
  }
  if (Object.keys(storage).length > 0) {
    input.storage = storage;
  }

  if (dirtyFields.expirationDate) {
    input.expiresAt = data.expirationDate?.toISOString() ?? null;
  }

  if (dirtyFields.tags) {
    input.tags = data.tags || [];
  }

  // Group threshold fields into thresholds: InventoryThresholdsInput
  const thresholds: InventoryThresholdsInput = {};
  if (dirtyFields.minQuantity) {
    thresholds.minQuantity = data.minQuantity
      ? parseFloat(data.minQuantity)
      : null;
  }
  if (dirtyFields.restockQuantity) {
    thresholds.restockQuantity = data.restockQuantity
      ? parseFloat(data.restockQuantity)
      : null;
  }
  if (Object.keys(thresholds).length > 0) {
    input.thresholds = thresholds;
  }

  // Group net weight fields into netWeight: NetWeightInput
  const netWeightInput: NetWeightInput = {};
  if (dirtyFields.netWeight) {
    netWeightInput.netWeight = data.netWeight
      ? parseFloat(data.netWeight)
      : null;
  }
  if (dirtyFields.netWeightUnit || dirtyFields.netWeightUnitId) {
    netWeightInput.netWeightUnitId = data.netWeightUnitId || null;
  }
  if (Object.keys(netWeightInput).length > 0) {
    input.netWeight = netWeightInput;
  }

  // Handle unit changes via UnitSpecInput (when unitId is unavailable)
  if (dirtyFields.unit && unitSymbol?.trim()) {
    input.unit = { unitSymbol: unitSymbol.trim() };
  }

  // Group brand fields into brand: BrandReferenceInput
  if (dirtyFields.brand) {
    if (brandId) {
      input.brand = { brandId };
    } else if (data.brand?.trim()) {
      input.brand = { brandName: data.brand.trim() };
    } else {
      input.brand = { brandId: null };
    }
  }

  return input;
}

/**
 * Map StorageState enum to the corresponding key in storageStateCounts.
 */
export function stateToCountKey(
  state: StorageState | string | undefined | null,
): 'refrigerated' | 'frozen' | 'ambient' {
  switch (state) {
    case StorageState.Refrigerated:
      return 'refrigerated';
    case StorageState.Frozen:
      return 'frozen';
    default:
      return 'ambient';
  }
}

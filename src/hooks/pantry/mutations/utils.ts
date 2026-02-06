/**
 * Shared utilities for pantry item mutations
 */

import { PantryItemFragment, UnitType } from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import type { UnitSelection, FormDataInput } from './types';

// Cache updater for adding items to Pantry.itemsConnection
export const addToPantryItemsCache = createAddToParentConnectionUpdater<any>(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

/**
 * Build optimistic Unit object for cache updates.
 * Includes all Unit fields from PantryItemFragment to prevent cache warnings.
 */
export function buildOptimisticUnit(
  newUnit: UnitSelection,
  currentUnit?: PantryItemFragment['unit'] | null,
): PantryItemFragment['unit'] | null {
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
): Record<string, any> {
  const input: Record<string, any> = {};

  if (dirtyFields.itemName) {
    input.itemName = data.itemName;
  }

  if (dirtyFields.storageState) {
    input.storageState = data.storageState;
  }

  if (dirtyFields.location && locationId) {
    input.storageLocationId = locationId;
  }

  if (dirtyFields.expirationDate) {
    input.expiresAt = data.expirationDate?.toISOString() ?? null;
  }

  if (dirtyFields.notes) {
    input.storageNotes = data.notes;
  }

  if (dirtyFields.tags) {
    input.tags = data.tags || [];
  }

  if (dirtyFields.minQuantity) {
    input.minQuantity = data.minQuantity ? parseFloat(data.minQuantity) : null;
  }

  if (dirtyFields.restockQuantity) {
    input.restockQuantity = data.restockQuantity
      ? parseFloat(data.restockQuantity)
      : null;
  }

  // Handle brand updates
  if (dirtyFields.brand) {
    if (brandId) {
      input.brandId = brandId;           // Selected existing brand
    } else if (data.brand?.trim()) {
      input.brandName = data.brand.trim(); // Create new brand by name
    } else {
      input.brandId = null;              // Remove brand
    }
  }

  return input;
}

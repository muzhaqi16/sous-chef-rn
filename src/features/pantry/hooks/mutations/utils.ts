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
import type { UnitSelection, FormDataInput } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

// Cache updater for adding items to Pantry.itemsConnection

/**
 * Optimistic `Unit` for a cache update. Writes exactly the fields every
 * `PantryItem.unit` selection names — one short and the whole read is
 * INCOMPLETE, so the fields here and in `writePantryItemDetailStub_unit` move
 * together.
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
    displayAsFraction: currentUnit?.displayAsFraction ?? false,
  };
}

/**
 * `version` is excluded because the form cannot dirty it; the caller adds it
 * from the entity being updated for the server's concurrency check.
 */
type DirtyUpdateInput = Omit<UpdatePantryItemInput, 'id' | 'version'>;

export function buildDirtyUpdateInput(
  data: FormDataInput,
  dirtyFields: Record<string, boolean>,
  locationId: string | null,
  brandId: string | null,
  unitSymbol?: string | null,
): DirtyUpdateInput {
  const input: DirtyUpdateInput = {};

  if (dirtyFields.itemName) {
    input.itemName = data.itemName;
  }

  // Group storage-related fields into storage: StorageDetailsInput
  const storage: StorageDetailsInput = {};
  if (dirtyFields.storageState) {
    storage.storageState = data.storageState;
  }
  if (dirtyFields.condition && data.condition) {
    storage.condition = data.condition;
  }
  // A selected location links by id; a freshly-typed name sends
  // storageLocationName so updatePantryItem find-or-creates it (case-insensitive
  // within the home, else a new CUSTOM location) and links it — matching the
  // create path. An explicit id wins when both are present.
  if (dirtyFields.location) {
    if (locationId) {
      storage.storageLocationId = locationId;
    } else if (data.location.trim()) {
      storage.storageLocationName = data.location.trim();
    }
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
      ? parseDecimalInput(data.minQuantity)
      : null;
  }
  if (dirtyFields.restockQuantity) {
    thresholds.restockQuantity = data.restockQuantity
      ? parseDecimalInput(data.restockQuantity)
      : null;
  }
  if (Object.keys(thresholds).length > 0) {
    input.thresholds = thresholds;
  }

  // Group net weight fields into netWeight: NetWeightInput
  const netWeightInput: NetWeightInput = {};
  if (dirtyFields.netWeight) {
    netWeightInput.netWeight = data.netWeight
      ? parseDecimalInput(data.netWeight)
      : null;
  }
  if (dirtyFields.netWeightUnit || dirtyFields.netWeightUnitId) {
    netWeightInput.netWeightUnitId = data.netWeightUnitId || null;
  }
  // API rule on update: a value without a unit is allowed, but a unit without
  // a value is rejected. Setting a unit therefore always sends the effective
  // weight value alongside it; with no value to attach it to, the unit change
  // is dropped rather than sent alone.
  if (netWeightInput.netWeightUnitId) {
    if (netWeightInput.netWeight === undefined && data.netWeight) {
      netWeightInput.netWeight = parseDecimalInput(data.netWeight);
    }
    if (netWeightInput.netWeight == null) {
      delete netWeightInput.netWeightUnitId;
    }
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

/**
 * Shared utilities for pantry item mutations
 */

import type {
  UpdatePantryItemInput,
  StorageDetailsInput,
  InventoryThresholdsInput,
  NetWeightInput,
} from '#/graphql/generated/schemaTypes';
import type { DirtyFieldFlags, FormDataInput } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { toDateKey } from '#/utils/dateUtils';

// Cache updater for adding items to Pantry.itemsConnection

/**
 * `version` is excluded because the form cannot dirty it; the caller adds it
 * from the entity being updated for the server's concurrency check.
 */
type DirtyUpdateInput = Omit<UpdatePantryItemInput, 'id' | 'version'>;

export function buildDirtyUpdateInput(
  data: FormDataInput,
  dirtyFields: DirtyFieldFlags,
  locationId: string | null,
  brandId: string | null,
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
  // A selected location links by id; a freshly-typed name makes
  // updatePantryItem find-or-create it (case-insensitive within the home, else a
  // new CUSTOM location) — matching the create path. An emptied field clears it.
  if (dirtyFields.location) {
    const locationName = data.location.trim();
    if (locationId) {
      storage.location = { id: locationId };
    } else if (locationName) {
      storage.location = { name: locationName };
    } else {
      storage.location = null;
    }
  }
  if (dirtyFields.notes) {
    storage.storageNotes = data.notes;
  }
  if (Object.keys(storage).length > 0) {
    input.storage = storage;
  }

  if (dirtyFields.expirationDate) {
    input.expiresOn = data.expirationDate
      ? toDateKey(data.expirationDate)
      : null;
  }

  if (dirtyFields.tags) {
    input.tags = data.tags ?? [];
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
    netWeightInput.netWeightUnitId =
      firstNonBlank(data.netWeightUnitId) ?? null;
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

  if (dirtyFields.brand) {
    if (brandId) {
      input.brand = { id: brandId };
    } else if (data.brand?.trim()) {
      input.brand = { name: data.brand.trim() };
    } else {
      input.brand = null;
    }
  }

  return input;
}

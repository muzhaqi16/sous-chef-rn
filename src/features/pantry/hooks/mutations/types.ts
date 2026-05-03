/**
 * Shared types for pantry item mutations
 */

import { StorageState, PantryItemFragment } from '#generated';

export interface UnitSelection {
  id: string | null;
  name: string | null;
  symbol: string | null;
  type: string | null;
}

export const emptyUnitSelection: UnitSelection = {
  id: null,
  name: null,
  symbol: null,
  type: null,
};

/**
 * Minimal interface for form data - accepts any object with these fields.
 * This avoids duplicating the form's data type while ensuring type safety.
 */
export interface FormDataInput {
  itemName?: string;
  selectedItemId?: string;
  brand?: string;
  quantityInput?: string;
  unit: string;
  minQuantity?: string;
  restockQuantity?: string;
  storageState: StorageState;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
  tags?: string[];
  netWeight?: string;
  netWeightUnit?: string;
  netWeightUnitId?: string;
}

export interface CreatePantryItemParams<
  T extends FormDataInput = FormDataInput,
> {
  input: T;
  pantryId: string;
  quantityValue: number;
  unitId: string | null;
  selectedLocationId: string | null;
  selectedCategoryId: string | null;
}

export interface UpdatePantryItemParams<
  T extends FormDataInput = FormDataInput,
> {
  itemId: string;
  input: T;
  currentItem: PantryItemFragment;
  dirtyFields: Record<string, boolean>;
  quantityValue: number;
  unitId: string | null;
  trackingUnit: UnitSelection;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
}

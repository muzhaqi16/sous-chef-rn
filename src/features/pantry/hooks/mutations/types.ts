/**
 * Shared types for pantry item mutations
 */

import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';

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
  condition?: ItemCondition;
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

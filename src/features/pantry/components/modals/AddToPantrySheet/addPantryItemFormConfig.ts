import { object, string, date, mixed, type ObjectSchema } from 'yup';
import {
  itemNameText,
  lazyMessage,
  quantityRule,
} from '#/utils/validation/common';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import {
  ACQUISITION_METHOD_OPTIONS,
  type OfferedAcquisitionMethod,
} from '#features/pantry/utils/itemEnumLabels';
import {
  isPickedWhenSized,
  isWholeWhenSized,
  packageContentsFields,
} from '#features/pantry/ui/packageContentsRules';
import type { AddPantryItemFormData } from '#features/pantry/types';

// Shape, defaults and validation for the four-page Add-to-Pantry sheet.
// Validation renders ON the field; `usePantryItemSubmission` only submits.

/** Which page each validated field lives on, so a failure can navigate to it. */
export const FIELD_PAGE: Partial<Record<keyof AddPantryItemFormData, number>> =
  {
    itemName: 0,
    quantityInput: 1,
    sizeInput: 1,
    sizeUnitId: 1,
  };

export const addPantryItemDefaults = (
  prefilledItemName: string,
): AddPantryItemFormData => ({
  itemName: prefilledItemName,
  brand: '',
  category: '',
  expirationDate: null,
  storageState: StorageState.Ambient,
  quantityInput: '1',
  unit: '',
  unitId: null,
  unitType: null,
  sizeInput: '',
  sizeUnitDisplay: '',
  sizeUnitId: null,
  sizeUnitType: null,
  storageLocation: '',
  selectedStorageLocationId: null,
  storageNotes: '',
  condition: ItemCondition.Good,
  tags: '',
  minQuantity: '',
  restockQuantity: '',
  storeName: '',
  storeId: null,
  costPerUnit: '',
  acquisitionMethod: AcquisitionMethod.Purchased,
});

export const addPantryItemSchema: ObjectSchema<AddPantryItemFormData> = object({
  itemName: itemNameText(lazyMessage('errors.itemNameRequired')),
  quantityInput: quantityRule('errors.invalidQuantity')
    .trim()
    .test(
      'whole-packages',
      lazyMessage('packageSize.wholePackages'),
      (value, context: { parent: AddPantryItemFormData }) =>
        isWholeWhenSized(
          value,
          context.parent.unitType,
          context.parent.sizeInput,
        ),
    ),
  ...packageContentsFields,
  sizeUnitId: string()
    .nullable()
    .defined()
    .test(
      'size-unit-picked',
      lazyMessage('packageSize.unitRequired'),
      (value, context: { parent: AddPantryItemFormData }) =>
        isPickedWhenSized(
          value,
          context.parent.unitType,
          context.parent.sizeInput,
        ),
    ),
  // Everything else is free-form; the mutation input builder handles shaping.
  brand: string().defined(),
  category: string().defined(),
  expirationDate: date().nullable().defined(),
  storageState: mixed<StorageState>()
    .oneOf(Object.values(StorageState))
    .defined(),
  unit: string().defined(),
  unitId: string().nullable().defined(),
  unitType: mixed<UnitType>()
    .oneOf(Object.values(UnitType))
    .nullable()
    .defined(),
  storageLocation: string().defined(),
  selectedStorageLocationId: string().nullable().defined(),
  storageNotes: string().defined(),
  condition: mixed<ItemCondition>()
    .oneOf(Object.values(ItemCondition))
    .defined(),
  tags: string().defined(),
  minQuantity: string().defined(),
  restockQuantity: string().defined(),
  storeName: string().defined(),
  storeId: string().nullable().defined(),
  costPerUnit: string().defined(),
  acquisitionMethod: mixed<OfferedAcquisitionMethod>()
    .oneOf(ACQUISITION_METHOD_OPTIONS)
    .defined(),
});

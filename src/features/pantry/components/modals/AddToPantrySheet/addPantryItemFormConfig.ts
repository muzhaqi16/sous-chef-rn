import { object, string, boolean, date, mixed, type ObjectSchema } from 'yup';
import { lazyMessage, quantityRule } from '#/utils/validation/common';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';
import {
  ACQUISITION_METHOD_OPTIONS,
  type OfferedAcquisitionMethod,
} from '#features/pantry/utils/itemEnumLabels';

// Shape, defaults and validation for the four-page Add-to-Pantry sheet.
// Validation lives here and renders ON the field; `usePantryItemSubmission`
// only submits. An alert covers the form, and once dismissed it cannot say
// which of the four pages the offending input is on.

// yup types a test's sibling values as `any`; these are the ones the rules read.
type NetWeightSiblings = Partial<
  Pick<
    AddPantryItemFormData,
    | 'pantryNetWeight'
    | 'pantryNetWeightUnitId'
    | 'showPackageDetails'
    | 'itemNetWeight'
    | 'weightUnitId'
  >
>;

export type AddPantryItemFormData = {
  // Page 1 — Main
  itemName: string;
  brand: string;
  category: string;
  expirationDate: Date | null;
  storageState: StorageState;
  // Page 2 — Details
  quantityInput: string;
  unit: string;
  unitId: string | null;
  pantryNetWeight: string;
  pantryNetWeightUnit: string;
  pantryNetWeightUnitId: string | null;
  showPackageDetails: boolean;
  packageSize: string;
  contentUnit: string;
  contentUnitId: string | null;
  itemNetWeight: string;
  weightUnit: string;
  weightUnitId: string | null;
  // Page 3 — Storage
  storageLocation: string;
  selectedStorageLocationId: string | null;
  storageNotes: string;
  condition: ItemCondition;
  tags: string;
  // Page 4 — Stock + Purchase
  minQuantity: string;
  restockQuantity: string;
  storeName: string;
  storeId: string | null;
  costPerUnit: string;
  acquisitionMethod: OfferedAcquisitionMethod;
};

/** Which page each validated field lives on, so a failure can navigate to it. */
export const FIELD_PAGE: Partial<Record<keyof AddPantryItemFormData, number>> =
  {
    itemName: 0,
    quantityInput: 1,
    pantryNetWeight: 1,
    pantryNetWeightUnit: 1,
    // Package details live on the Details page too.
    itemNetWeight: 1,
    weightUnit: 1,
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
  pantryNetWeight: '',
  pantryNetWeightUnit: '',
  pantryNetWeightUnitId: null,
  showPackageDetails: false,
  packageSize: '',
  contentUnit: '',
  contentUnitId: null,
  itemNetWeight: '',
  weightUnit: '',
  weightUnitId: null,
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
  itemName: string().trim().required(lazyMessage('errors.itemNameRequired')),
  quantityInput: quantityRule('errors.invalidQuantity').trim(),
  // ALL-OR-NOTHING in BOTH directions: the create contract rejects a unit id
  // with no weight, and the submit path drops a weight with no resolved unit
  // id. Each direction reports on the field the user has to fill.
  pantryNetWeight: string()
    .test(
      'net-weight-needs-value',
      lazyMessage('errors.field.netWeight'),
      (value, context: { parent: NetWeightSiblings }) => {
        if ((value ?? '').trim()) return true;
        return !context.parent.pantryNetWeightUnitId;
      },
    )
    .defined(),
  pantryNetWeightUnit: string()
    .defined()
    .test(
      'net-weight-needs-unit',
      lazyMessage('labels.pleaseSelectAUnitForTheNetWeight'),
      (_value, context: { parent: NetWeightSiblings }) => {
        const weight = (context.parent.pantryNetWeight ?? '').trim();
        if (!weight) return true;
        return Boolean(context.parent.pantryNetWeightUnitId);
      },
    ),
  // The same all-or-nothing rule one level down, on the per-container weight
  // that feeds `item.netWeight` + `item.displayUnitId`: without it a unitless
  // weight is silently dropped. Scoped to `showPackageDetails` so a collapsed
  // section can never block Save.
  itemNetWeight: string()
    .test(
      'item-net-weight-needs-value',
      lazyMessage('errors.field.netWeight'),
      (value, context: { parent: NetWeightSiblings }) => {
        if (!context.parent.showPackageDetails) return true;
        if ((value ?? '').trim()) return true;
        return !context.parent.weightUnitId;
      },
    )
    .defined(),
  weightUnit: string()
    .defined()
    .test(
      'item-net-weight-needs-unit',
      lazyMessage('labels.pleaseSelectAUnitForTheNetWeight'),
      (_value, context: { parent: NetWeightSiblings }) => {
        if (!context.parent.showPackageDetails) return true;
        const weight = (context.parent.itemNetWeight ?? '').trim();
        if (!weight) return true;
        return Boolean(context.parent.weightUnitId);
      },
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
  pantryNetWeightUnitId: string().nullable().defined(),
  showPackageDetails: boolean().defined(),
  packageSize: string().defined(),
  contentUnit: string().defined(),
  contentUnitId: string().nullable().defined(),
  weightUnitId: string().nullable().defined(),
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

import { object, string, boolean, date } from 'yup';
import { t } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';

// Shape, defaults and validation for the four-page Add-to-Pantry sheet.
// Validation lives here and renders ON the field; `usePantryItemSubmission`
// only submits. An alert covers the form, and once dismissed it cannot say
// which of the four pages the offending input is on.

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one would freeze whichever language was active at import
// time. Yup calls this when the rule fails.
const msg = (key: string) => (): string => t(key);

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
  acquisitionMethod: AcquisitionMethod;
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

// Defers to `parseFractionalInput` rather than restating its grammar: a regex
// mirroring the accepted forms by hand drifts from the parser — one that took
// only `.` as the decimal separator made `2,5` unreachable in es/it/sq, whose
// `decimal-pad` offers no `.` at all.
const isPositiveQuantity = (value: string | undefined): boolean => {
  if (!value?.trim()) return false;
  const parsed = parseFractionalInput(value);
  return parsed !== null && parsed > 0;
};

export const addPantryItemSchema = object({
  itemName: string().trim().required(msg('errors.itemNameRequired')),
  quantityInput: string()
    .trim()
    .required(msg('errors.invalidQuantity'))
    .test(
      'positive-quantity',
      msg('errors.invalidQuantity'),
      isPositiveQuantity,
    ),
  // ALL-OR-NOTHING in BOTH directions: the create contract rejects a unit id
  // with no weight, and the submit path drops a weight with no resolved unit
  // id. Each direction reports on the field the user has to fill.
  pantryNetWeight: string().test(
    'net-weight-needs-value',
    msg('errors.field.netWeight'),
    (value, context) => {
      if ((value ?? '').trim()) return true;
      return !context.parent.pantryNetWeightUnitId;
    },
  ),
  pantryNetWeightUnit: string().test(
    'net-weight-needs-unit',
    msg('labels.pleaseSelectAUnitForTheNetWeight'),
    (_value, context) => {
      const weight = (context.parent.pantryNetWeight ?? '').trim();
      if (!weight) return true;
      return Boolean(context.parent.pantryNetWeightUnitId);
    },
  ),
  // The same all-or-nothing rule one level down, on the per-container weight
  // that feeds `item.netWeight` + `item.displayUnitId`: without it a unitless
  // weight is silently dropped. Scoped to `showPackageDetails` so a collapsed
  // section can never block Save.
  itemNetWeight: string().test(
    'item-net-weight-needs-value',
    msg('errors.field.netWeight'),
    (value, context) => {
      if (!context.parent.showPackageDetails) return true;
      if ((value ?? '').trim()) return true;
      return !context.parent.weightUnitId;
    },
  ),
  weightUnit: string().test(
    'item-net-weight-needs-unit',
    msg('labels.pleaseSelectAUnitForTheNetWeight'),
    (_value, context) => {
      if (!context.parent.showPackageDetails) return true;
      const weight = (context.parent.itemNetWeight ?? '').trim();
      if (!weight) return true;
      return Boolean(context.parent.weightUnitId);
    },
  ),
  // Everything else is free-form; the mutation input builder handles shaping.
  brand: string(),
  category: string(),
  expirationDate: date().nullable(),
  storageState: string().oneOf(Object.values(StorageState)),
  unit: string(),
  unitId: string().nullable(),
  pantryNetWeightUnitId: string().nullable(),
  showPackageDetails: boolean(),
  packageSize: string(),
  contentUnit: string(),
  contentUnitId: string().nullable(),
  weightUnitId: string().nullable(),
  storageLocation: string(),
  selectedStorageLocationId: string().nullable(),
  storageNotes: string(),
  condition: string().oneOf(Object.values(ItemCondition)),
  tags: string(),
  minQuantity: string(),
  restockQuantity: string(),
  storeName: string(),
  storeId: string().nullable(),
  costPerUnit: string(),
  acquisitionMethod: string().oneOf(Object.values(AcquisitionMethod)),
});

import { object, string, boolean, date } from 'yup';
import { t } from '#/i18n';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';

/**
 * Shape, defaults and validation for the four-page Add-to-Pantry sheet.
 *
 * Split from `usePantryItemSubmission` on purpose: that hook builds the
 * mutation input and fires it, and used to ALSO validate — reporting failures
 * through `alertService.alert`, which covers the form, has to be dismissed
 * before the field can be corrected, and once dismissed no longer says which
 * of the four pages the offending input is on. Validation lives here now and
 * renders on the field; the hook only submits.
 */

/**
 * Messages resolve LAZILY — the schema is built once at module scope, so an
 * eagerly-resolved message would freeze whichever language was active at
 * import time. Yup calls this when the rule fails. Same pattern as
 * `src/utils/validation/common.ts`.
 */
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

/**
 * A quantity may be fractional ("1/2", "1 1/4") — parsing lives in
 * `parseFractionalInput`, so the schema only asserts it is present and
 * resolves to a positive number.
 */
const isPositiveQuantity = (value: string | undefined): boolean => {
  if (!value?.trim()) return false;
  // Mirrors parseFractionalInput's accepted forms without importing it into a
  // module-scope schema: whole, decimal, "a/b", or "a b/c".
  const match = value
    .trim()
    .match(/^(\d+(?:\.\d+)?)$|^(\d+)\/(\d+)$|^(\d+)\s+(\d+)\/(\d+)$/);
  if (!match) return false;
  const [, plain, num, den, whole, wnum, wden] = match;
  if (plain !== undefined) return Number(plain) > 0;
  if (num !== undefined)
    return Number(den) !== 0 && Number(num) / Number(den) > 0;
  return Number(whole) + Number(wnum) / Number(wden) > 0;
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
  // Net weight is ALL-OR-NOTHING in BOTH directions — the same rule the
  // shopping-item form applies, against the same create contract: "a
  // netWeightUnitId with no netWeight is always rejected", and a weight with no
  // resolved unit id is dropped by the submit path. Each direction reports on
  // the field the user has to fill.
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
  itemNetWeight: string(),
  weightUnit: string(),
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

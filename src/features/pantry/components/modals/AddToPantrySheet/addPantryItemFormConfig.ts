import { object, string, boolean, date } from 'yup';
import { t } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
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

/**
 * A quantity may be fractional ("1/2", "1 1/4") — parsing lives in
 * `parseFractionalInput`, so the schema only asserts it is present and
 * resolves to a positive number.
 *
 * It defers to the parser rather than restating its grammar. The regex that
 * stood here mirrored the accepted forms by hand and matched only `.` as the
 * decimal separator, so `2,5` failed validation on exactly the devices whose
 * `decimal-pad` offers no `.` at all — fractional quantities were unreachable
 * in es, it and sq. Validation and parsing have to agree, and the only way to
 * guarantee that is to ask the parser.
 */
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
  // The package-details per-container weight is the SAME all-or-nothing rule,
  // one level down: it feeds `item.netWeight` + `item.displayUnitId` inline,
  // and (times the package size) the pantry-level `NetWeightInput`. Without
  // this, a weight typed with no unit was dropped from the pantry input by the
  // both-or-neither guard in the submit path and sent inline as a unitless
  // Float — the value vanished with nothing reported. Scoped to
  // `showPackageDetails` so a collapsed section can never block Save.
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

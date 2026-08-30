import { object, string } from 'yup';
import { t } from '#/i18n';
// Pages, order and label keys are the ADD form's, declared once in the catalog's
// public `ui/`. `PageName` is an IDENTIFIER, never a tab label — resolve it
// through `PAGE_LABEL_KEYS`. Only `TAB_FIELDS` below is this form's own.
import type { PageName } from '#features/catalog/ui/AddItemForm/fields';
import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';

// Messages resolve LAZILY: the schemas are built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
// Uses the SAME keys as `addPantryItemFormConfig.ts` so the two cannot drift.
const msg = (key: string) => (): string => t(key);

// Drives the per-tab error indicators on PageIndicator. Tags lives inside the
// Inventory "More options" expander.
export const TAB_FIELDS: Record<PageName, readonly string[]> = {
  Basics: ['itemName', 'brand', 'category'],
  Product: ['netWeight', 'netWeightUnit'],
  Storage: ['storageState', 'condition', 'location', 'expirationDate', 'notes'],
  Inventory: ['quantityInput', 'unit', 'minQuantity', 'restockQuantity'],
};

export const INVENTORY_ADVANCED_FIELDS: readonly string[] = ['tags'];

export const addItemSchema = object({
  itemName: string().required(msg('errors.itemNameRequired')),
  quantityInput: string().required(msg('errors.invalidQuantity')),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  // All-or-nothing: `usePantryItemSubmission` drops the weight unless BOTH a
  // value and a resolved unit id are present, so not refusing the half-filled
  // pair discards what the user typed with nothing reported.
  netWeight: string().test(
    'net-weight-needs-value',
    msg('errors.field.netWeight'),
    (value, context) => {
      if ((value ?? '').trim()) return true;
      return !context.parent.netWeightUnitId;
    },
  ),
  netWeightUnit: string().test(
    'net-weight-needs-unit',
    msg('labels.pleaseSelectAUnitForTheNetWeight'),
    (_value, context) => {
      const weight = (context.parent.netWeight ?? '').trim();
      if (!weight) return true;
      return Boolean(context.parent.netWeightUnitId);
    },
  ),
  netWeightUnitId: string(),
  storageState: string().oneOf(Object.values(StorageState)),
  condition: string().oneOf(Object.values(ItemCondition)),
  location: string(),
  notes: string(),
  category: string(),
  brand: string(),
});

export const editItemSchema = object({
  itemName: string(),
  quantityInput: string().required(msg('errors.invalidQuantity')),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  // All-or-nothing: `usePantryItemSubmission` drops the weight unless BOTH a
  // value and a resolved unit id are present, so not refusing the half-filled
  // pair discards what the user typed with nothing reported.
  netWeight: string().test(
    'net-weight-needs-value',
    msg('errors.field.netWeight'),
    (value, context) => {
      if ((value ?? '').trim()) return true;
      return !context.parent.netWeightUnitId;
    },
  ),
  netWeightUnit: string().test(
    'net-weight-needs-unit',
    msg('labels.pleaseSelectAUnitForTheNetWeight'),
    (_value, context) => {
      const weight = (context.parent.netWeight ?? '').trim();
      if (!weight) return true;
      return Boolean(context.parent.netWeightUnitId);
    },
  ),
  netWeightUnitId: string(),
  storageState: string().oneOf(Object.values(StorageState)),
  condition: string().oneOf(Object.values(ItemCondition)),
  location: string(),
  notes: string(),
  category: string(),
  brand: string(),
});

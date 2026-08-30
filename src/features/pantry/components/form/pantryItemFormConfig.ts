import { object, string } from 'yup';
import { t } from '#/i18n';
// The four pages, their order and their label keys are the ADD form's, declared
// once in the catalog's public `ui/`. `PageName` is an IDENTIFIER, not copy —
// this form used to hand it straight to the tab bar as the label, so the tabs
// read "Basics / Product / Storage / Inventory" in every language while the add
// form next door was translated. Only `TAB_FIELDS` below is this form's own.
import type { PageName } from '#features/catalog/ui/AddItemForm/fields';
import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';

/**
 * Schema messages resolve LAZILY.
 *
 * The schemas below are built once at module scope, so a message resolved
 * eagerly freezes whichever language was active at import time — and these
 * two were not even that, they were English string literals. Yup calls the
 * function when the rule fails, which lands after any language change.
 *
 * Mirrors `addPantryItemFormConfig.ts`, and uses the SAME keys: one string per
 * meaning, so the add sheet and the edit form cannot drift apart.
 */
const msg = (key: string) => (): string => t(key);

// Maps each tab to the form field names it owns — drives per-tab error
// indicators on PageIndicator. Tags lives inside the Inventory "More options"
// expander.
export const TAB_FIELDS: Record<PageName, readonly string[]> = {
  Basics: ['itemName', 'brand', 'category'],
  Product: ['netWeight', 'netWeightUnit'],
  Storage: ['storageState', 'condition', 'location', 'expirationDate', 'notes'],
  Inventory: ['quantityInput', 'unit', 'minQuantity', 'restockQuantity'],
};

export const INVENTORY_ADVANCED_FIELDS: readonly string[] = ['tags'];

// Schema for add mode
export const addItemSchema = object({
  itemName: string().required(msg('errors.itemNameRequired')),
  quantityInput: string().required(msg('errors.invalidQuantity')),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  // The same all-or-nothing net-weight pair the add sheet enforces, against the
  // same create contract. `usePantryItemSubmission` drops the weight unless BOTH
  // a value and a resolved unit id are present, so a form that does not refuse
  // the half-filled pair discards what the user typed with nothing reported —
  // and `TAB_FIELDS.Product` already declares these two as carrying a message.
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

// Schema for edit mode
export const editItemSchema = object({
  itemName: string(),
  quantityInput: string().required(msg('errors.invalidQuantity')),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  // The same all-or-nothing net-weight pair the add sheet enforces, against the
  // same create contract. `usePantryItemSubmission` drops the weight unless BOTH
  // a value and a resolved unit id are present, so a form that does not refuse
  // the half-filled pair discards what the user typed with nothing reported —
  // and `TAB_FIELDS.Product` already declares these two as carrying a message.
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

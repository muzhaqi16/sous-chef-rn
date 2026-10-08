import { object, string } from 'yup';
import { lazyMessage } from '#/utils/validation/common';
// Pages, order and label keys are the ADD form's, declared once in the catalog's
// public `ui/`. `PageName` is an IDENTIFIER, never a tab label — resolve it
// through `PAGE_LABEL_KEYS`. Only `TAB_FIELDS` below is this form's own.
import type { PageName } from '#features/catalog/ui/AddItemForm/fields';
import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import type { PantryItemFormData } from './PantryItemForm';

type FieldName = keyof PantryItemFormData;

// yup types a test's sibling values as `any`; these are the ones the rules read.
type NetWeightSiblings = Partial<
  Pick<PantryItemFormData, 'netWeight' | 'netWeightUnitId'>
>;

// Drives the per-tab error indicators on PageIndicator. Tags lives inside the
// Inventory "More options" expander.
export const TAB_FIELDS: Record<PageName, readonly FieldName[]> = {
  Basics: ['itemName', 'brand', 'category'],
  Product: ['netWeight', 'netWeightUnit'],
  Storage: ['storageState', 'condition', 'location', 'expirationDate', 'notes'],
  Inventory: ['quantityInput', 'unit', 'minQuantity', 'restockQuantity'],
};

export const INVENTORY_ADVANCED_FIELDS: readonly FieldName[] = ['tags'];

// The SAME message keys as `addPantryItemFormConfig.ts`, so the two cannot drift.
export const editItemSchema = object({
  itemName: string(),
  // The submit parses it with the same reader, so text it cannot read never gets there.
  quantityInput: string()
    .required(lazyMessage('errors.invalidQuantity'))
    .test(
      'parseable',
      lazyMessage('errors.invalidQuantity'),
      value => !value || parseFractionalInput(value) !== null,
    ),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  // All-or-nothing: `usePantryItemSubmission` drops the weight unless BOTH a
  // value and a resolved unit id are present, so not refusing the half-filled
  // pair discards what the user typed with nothing reported.
  netWeight: string().test(
    'net-weight-needs-value',
    lazyMessage('errors.field.netWeight'),
    (value, context: { parent: NetWeightSiblings }) => {
      if ((value ?? '').trim()) return true;
      return !context.parent.netWeightUnitId;
    },
  ),
  // Typed text passes: the submit resolves it to a unit, and reports on this
  // field when it can't.
  netWeightUnit: string().test(
    'net-weight-needs-unit',
    lazyMessage('labels.pleaseSelectAUnitForTheNetWeight'),
    (value, context: { parent: NetWeightSiblings }) => {
      const weight = (context.parent.netWeight ?? '').trim();
      if (!weight) return true;
      return (
        Boolean(context.parent.netWeightUnitId) || Boolean((value ?? '').trim())
      );
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

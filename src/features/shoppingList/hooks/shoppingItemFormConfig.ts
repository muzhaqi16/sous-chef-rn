import { object, string, number } from 'yup';
import { t } from '#/i18n';

/**
 * Shape, defaults and validation for the shopping-list item form. Shared by the
 * `AddEditItem` screen and the `AddToShoppingListSheet` details step, so the two
 * cannot drift on what is required or on what the message says.
 */

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly-resolved message would freeze the import-time language.
const msg = (key: string) => (): string => t(key);

export type ShoppingItemFormData = {
  itemName: string;
  quantityInput: string;
  unit: string;
  selectedUnitId: string | null;
  notes: string;
  category: string;
  estimatedPrice: string;
  /** Priority Int (0 low, 1 medium, 2 high); see shoppingList/utils/priority. */
  priority: number;
  /** Preferred store (storePrefs.preferredStoreId). */
  storeId: string | null;
  /** Display label for `storeId`, never sent on its own — excluded from dirty tracking. */
  storeName: string;
  /** Brand as typed; `brandId` is set only by picking a suggestion. */
  brand: string;
  brandId: string | null;
  /** Package size (net weight) as typed, plus its unit. */
  netWeight: string;
  netWeightUnit: string;
  netWeightUnitId: string | null;
};

export const SHOPPING_ITEM_DEFAULTS: ShoppingItemFormData = {
  itemName: '',
  quantityInput: '1',
  unit: '',
  selectedUnitId: null,
  notes: '',
  category: '',
  estimatedPrice: '',
  priority: 0,
  storeId: null,
  storeName: '',
  brand: '',
  brandId: null,
  netWeight: '',
  netWeightUnit: '',
  netWeightUnitId: null,
};

// `storeName` is the display label for `storeId`, never sent on its own, so a
// change to it must not mark the form dirty.
export const DIRTY_TRACKED_FIELDS = Object.keys(SHOPPING_ITEM_DEFAULTS).filter(
  field => field !== 'storeName',
) as (keyof ShoppingItemFormData)[];

export const shoppingItemSchema = object({
  itemName: string().trim().required(msg('errors.itemNameRequired')),
  quantityInput: string()
    .trim()
    .required(msg('shoppingListScreens.pleaseEnterQuantity')),
  unit: string(),
  selectedUnitId: string().nullable(),
  notes: string(),
  category: string(),
  estimatedPrice: string(),
  priority: number(),
  storeId: string().nullable(),
  storeName: string(),
  brand: string(),
  brandId: string().nullable(),
  // Net weight is ALL-OR-NOTHING in both directions: `netWeight` and
  // `netWeightUnitId` are either both set or both empty — either half alone is
  // dropped by both submit paths. Each direction reports on the field to fill.
  netWeight: string().test(
    'net-weight-needs-value',
    msg('errors.field.netWeight'),
    (value, context) => {
      if ((value ?? '').trim()) return true;
      return !context.parent.netWeightUnitId;
    },
  ),
  // Satisfied by `netWeightUnitId` alone — `NetWeightInput` has no symbol field,
  // so a unit typed but never resolved to an id is structurally unsendable.
  netWeightUnit: string().test(
    'net-weight-needs-unit',
    msg('labels.pleaseSelectAUnitForTheNetWeight'),
    (_value, context) => {
      const weight = (context.parent.netWeight ?? '').trim();
      if (!weight) return true;
      return Boolean(context.parent.netWeightUnitId);
    },
  ),
  netWeightUnitId: string().nullable(),
});

import { string, number, array, object, boolean, type InferType } from 'yup';
import {
  itemNameText,
  lazyMessage,
  normalizeSmartPunctuation,
} from '#/utils/validation/common';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import type { KeyUnder } from '#/i18n';
import {
  BaseDimension,
  ItemType,
  StorageState,
} from '#/graphql/generated/schemaTypes';

const msg = (
  key: KeyUnder<'itemValidation'>,
  options?: Record<string, unknown>,
) => lazyMessage(`itemValidation.${key}`, options);

/**
 * yup's own number cast rejects "0,5", which a comma keypad types. Typed text is
 * read with the decimal parser instead; blank is absent, unreadable is `NaN`.
 */
const decimalText = (value: unknown, originalValue: unknown): unknown => {
  if (typeof originalValue !== 'string') return value;
  return originalValue.trim() === ''
    ? undefined
    : parseDecimalInput(originalValue);
};

// --- item-specific validation rules ------------------------------------------

// The API refuses no character in a name, so neither does the form: a catalog
// name such as "Cashew Splits R/s" must survive an edit.
export const itemNameRule = itemNameText(msg('nameRequired'));

// Description validation
export const descriptionRule = string()
  .max(500, msg('descriptionMax', { count: 500 }))
  .optional();

// '' becomes undefined so `.optional()` applies; else `.min(8)` and `.matches()`
// refuse it and block every submit that didn't start from a scanned barcode.
export const upcRule = string()
  .transform((value: unknown) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  .matches(/^[0-9]+$/, msg('upcDigits'))
  .min(8, msg('upcMin', { count: 8 }))
  .max(18, msg('upcMax', { count: 18 }))
  .optional();

export const skuRule = string()
  .max(50, msg('skuMax', { count: 50 }))
  .optional();

// URL validation
export const urlRule = string().url(msg('urlInvalid')).optional();

// Shelf life validation (in days)
export const shelfLifeDaysRule = number()
  .transform((value: unknown, originalValue: unknown) =>
    String(originalValue).trim() === '' ? undefined : value,
  )
  .typeError(msg('wholeNumber'))
  .integer(msg('wholeNumber'))
  .min(1, msg('shelfLifeMin'))
  .max(3650, msg('shelfLifeMax', { count: 10 }))
  .optional();

// Shelf life once opened validation (in days)
export const shelfLifeOpenedDaysRule = number()
  .transform((value: unknown, originalValue: unknown) =>
    String(originalValue).trim() === '' ? undefined : value,
  )
  .typeError(msg('wholeNumber'))
  .integer(msg('wholeNumber'))
  .min(1, msg('shelfLifeOpenedMin'))
  .max(3650, msg('shelfLifeOpenedMax', { count: 10 }))
  .optional();

// Category IDs validation
export const categoryIdsRule = array().of(string().required()).optional();

// Units array validation
export const unitsRule = array()
  .of(
    object({
      unitId: string().optional(),
      unitName: string().optional(),
      isDefault: boolean().default(false),
      packageSize: number()
        .typeError(msg('greaterThanZero'))
        .min(0.001, msg('greaterThanZero'))
        .optional(),
      contentUnitId: string().optional(),
      contentUnitName: string().optional(),
      retailUnit: boolean().optional(),
      packageDescription: string().optional(),
      conversionRatio: number()
        .typeError(msg('greaterThanZero'))
        .min(0.001, msg('greaterThanZero'))
        .optional(),
    }),
  )
  .optional();

// Vendor/Brand name validation
export const vendorRule = string()
  .max(100, msg('vendorMax', { count: 100 }))
  .optional();

// Tags validation (array of strings)
// Transform handles the case where the form value is still a comma-separated
// string (onChange validation fires before the blur transform runs).
export const tagsRule = array()
  .transform((value: unknown, originalValue: unknown) => {
    if (typeof originalValue === 'string') {
      return originalValue
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }
    return value;
  })
  .of(
    string()
      .trim()
      .max(30, msg('tagMax', { count: 30 })),
  )
  .max(10, msg('tagsMax', { count: 10 }))
  .optional();

// Selected images validation (for multi-image picker)
export const selectedImagesRule = array()
  .of(
    object({
      uri: string().required(),
      fileName: string().optional(),
      perspective: string()
        .oneOf([
          'front',
          'back',
          'left',
          'right',
          'top',
          'nutrition_label',
          'ingredient_list',
        ])
        .default('front'),
    }),
  )
  .optional();

// Edit reason validation (for suggest-edit flow)
export const editReasonRule = string()
  .max(500, msg('editReasonMax', { count: 500 }))
  .optional();

/**
 * Floor for any free-text moderation reason a human acts on; the suggest-edit
 * note and the item report share it. The server only checks for emptiness, so
 * the minimum is ours: 10 characters turns away "fix" and "." .
 */
export const MIN_EDIT_REASON_LENGTH = 10;

export const editReasonRequiredRule = string()
  .transform(normalizeSmartPunctuation)
  .trim()
  .required(msg('editReasonRequired'))
  .min(
    MIN_EDIT_REASON_LENGTH,
    msg('editReasonMin', { count: MIN_EDIT_REASON_LENGTH }),
  )
  .max(500, msg('editReasonMax', { count: 500 }));

// --- Create Item validation schema -------------------------------------------

export const createItemSchema = object({
  // Basic Information (required)
  name: itemNameRule,

  // Basic Information (optional)
  description: descriptionRule.nullable(),
  upc: upcRule,
  sku: skuRule,
  editReason: editReasonRule,
  // Display text for the store autocomplete. The resolved store id is tracked
  // separately (selectedStoreId); this field only holds the searchable name.
  storeName: string().optional(),

  // Net Weights (manufacturer-provided, e.g., dual-label packaging)
  netWeights: array()
    .of(
      object({
        // A row the user left blank arrives as `NaN` — the number type rejects
        // it before `required` is reached, so the message has to be set here
        // too or yup's untranslated default reaches the screen.
        value: number()
          .transform(decimalText)
          .typeError(msg('netWeightValueRequired'))
          .min(0.001, msg('netWeightMin'))
          .required(msg('netWeightValueRequired')),
        unitName: string().required(msg('netWeightUnitRequired')),
        // The unit the user picked, carried so the server links it directly
        // instead of re-resolving the name.
        unitId: string().optional(),
      }),
    )
    .optional(),

  // Product Details
  type: string().oneOf(Object.values(ItemType)).nullable().optional(),
  storageState: string()
    .oneOf(Object.values(StorageState))
    .nullable()
    .optional(),
  shelfLifeDays: shelfLifeDaysRule,
  shelfLifeOpenedDays: shelfLifeOpenedDaysRule,
  // `''` is the picker's "none" option.
  baseDimension: string()
    .oneOf([...Object.values(BaseDimension), ''])
    .nullable()
    .optional(),
  defaultConsumeIncrement: number()
    .transform(decimalText)
    .typeError(msg('greaterThanZero'))
    .min(0.001, msg('greaterThanZero'))
    .optional(),
  defaultConsumeUnitId: string().optional(),

  // Images
  imageUrl: urlRule,
  selectedImages: selectedImagesRule,

  // Brand Information
  brandId: string().optional(),
  vendor: vendorRule,

  // Categories
  categoryIds: categoryIdsRule,

  // Units
  units: unitsRule,

  // Metadata
  tags: tagsRule,

  // Boolean flags
  isFoodStampItem: boolean().optional(),
  isFsaEligible: boolean().optional(),
});

export type CreateItemFormData = InferType<typeof createItemSchema>;

/**
 * Create, plus a MANDATORY note: `CreateItemSuggestionInput.note` is `String!`
 * and the reviewer's only context. A direct edit (the viewer's own private
 * item) has no reviewer, so it keeps `createItemSchema`.
 */
export const suggestItemEditSchema = createItemSchema.shape({
  editReason: editReasonRequiredRule,
});

import { string, number, array, object, boolean, type InferType } from 'yup';
import { normalizeSmartPunctuation } from './common';
import { getI18n } from '#/i18n/config';

/**
 * These schemas are built once at module scope, so a message resolved eagerly
 * would freeze whichever language happened to be active at import time. Yup
 * accepts a function and calls it when the rule actually fails, so the lookup
 * lands after any language change.
 */
const msg = (key: string, options?: Record<string, unknown>) => (): string =>
  getI18n().t(`itemValidation.${key}`, options);

// --- item-specific validation rules ------------------------------------------

// Item name validation
export const itemNameRule = string()
  .required(msg('nameRequired'))
  .transform(normalizeSmartPunctuation)
  .min(1, msg('nameEmpty'))
  .max(100, msg('nameMax', { count: 100 }))
  .matches(/^[a-zA-Z0-9\s\-_'.,()&]+$/, msg('nameChars'));

// Description validation
export const descriptionRule = string()
  .max(500, msg('descriptionMax', { count: 500 }))
  .optional();

// UPC validation (replaces barcode)
// Transform: empty string -> undefined so the optional flag actually kicks in.
// Without this, `.min(8)` and `.matches()` run on '' and fail, which blocks
// form submission for any flow that doesn't start with a scanned barcode.
export const upcRule = string()
  .transform(value =>
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
  .transform((value, originalValue) =>
    String(originalValue).trim() === '' ? undefined : value,
  )
  .integer(msg('wholeNumber'))
  .min(1, msg('shelfLifeMin'))
  .max(3650, msg('shelfLifeMax', { count: 10 }))
  .optional();

// Shelf life once opened validation (in days)
export const shelfLifeOpenedDaysRule = number()
  .transform((value, originalValue) =>
    String(originalValue).trim() === '' ? undefined : value,
  )
  .integer(msg('wholeNumber'))
  .min(1, msg('shelfLifeOpenedMin'))
  .max(3650, msg('shelfLifeOpenedMax', { count: 10 }))
  .optional();

// Display price per unit validation
export const displayPricePerUnitRule = string()
  .max(50, msg('displayPricePerUnitMax', { count: 50 }))
  .optional();

// Unit quantity validation
export const unitQtyRule = number()
  .transform((value, originalValue) =>
    String(originalValue).trim() === '' ? undefined : value,
  )
  .min(0.001, msg('unitQtyMin'))
  .optional();

// Default unit validation (symbol)
export const defaultUnitRule = string()
  .max(10, msg('defaultUnitMax', { count: 10 }))
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
      packageSize: number().min(0.001).optional(),
      contentUnitId: string().optional(),
      contentUnitName: string().optional(),
      retailUnit: boolean().optional(),
      packageDescription: string().optional(),
      conversionRatio: number().min(0.001).optional(),
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
  .transform((value, originalValue) => {
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
 * Floor for any free-text moderation reason a human has to act on — the
 * suggest-edit note and the item report both apply it, so the two stay in step.
 *
 * The server only trims and checks for emptiness, with no length floor, so the
 * minimum is ours to set. 10 characters turns away "fix" / "wrong" / "."
 * without being onerous.
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
        value: number()
          .min(0.001, msg('netWeightMin'))
          .required(msg('netWeightValueRequired')),
        unitName: string().required(msg('netWeightUnitRequired')),
      }),
    )
    .optional(),

  // Product Details
  type: string().nullable().optional(),
  storageState: string().nullable().optional(),
  shelfLifeDays: shelfLifeDaysRule,
  shelfLifeOpenedDays: shelfLifeOpenedDaysRule,
  baseDimension: string().nullable().optional(),
  defaultConsumeIncrement: number()
    .transform((value, originalValue) =>
      String(originalValue).trim() === '' ? undefined : value,
    )
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
 * Suggestion schema: identical to create, except the note is mandatory.
 * `CreateItemSuggestionInput.note` is `String!`, and the reviewing admin has nothing
 * but the note to judge the diff against.
 *
 * Only for the suggestion path. The direct-edit path has no reviewer and the
 * server no longer accepts a note on `UpdateItemInput`, so it keeps
 * `createItemSchema` and its form omits the note field entirely.
 */
export const suggestItemEditSchema = createItemSchema.shape({
  editReason: editReasonRequiredRule,
});

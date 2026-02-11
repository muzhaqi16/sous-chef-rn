import { string, number, array, object, boolean, type InferType } from 'yup';

// --- item-specific validation rules ------------------------------------------

// Item name validation
export const itemNameRule = string()
  .required('Item name is required')
  .min(1, 'Item name cannot be empty')
  .max(100, 'Item name cannot exceed 100 characters')
  .matches(
    /^[a-zA-Z0-9\s\-_'.,()&]+$/,
    'Item name can only contain letters, numbers, spaces, and common punctuation',
  );

// Description validation
export const descriptionRule = string()
  .max(500, 'Description cannot exceed 500 characters')
  .optional();

// UPC validation (replaces barcode)
export const upcRule = string()
  .matches(/^[0-9]+$/, 'UPC must contain only numbers')
  .min(8, 'UPC must be at least 8 digits')
  .max(18, 'UPC cannot exceed 18 digits')
  .optional();

export const skuRule = string()
  .max(50, 'SKU cannot exceed 50 characters')
  .optional();

// URL validation
export const urlRule = string().url('Please enter a valid URL').optional();

// Shelf life validation (in days)
export const shelfLifeDaysRule = number()
  .transform((value, originalValue) =>
    String(originalValue).trim() === '' ? undefined : value
  )
  .integer('Must be a whole number')
  .min(1, 'Shelf life must be at least 1 day')
  .max(3650, 'Shelf life cannot exceed 10 years')
  .optional();

// Display item size validation
export const displayItemSizeRule = string()
  .max(50, 'Display size cannot exceed 50 characters')
  .optional();

// Display price per unit validation
export const displayPricePerUnitRule = string()
  .max(50, 'Display price per unit cannot exceed 50 characters')
  .optional();

// Net weight validation
export const netWeightRule = number()
  .transform((value, originalValue) =>
    String(originalValue).trim() === '' ? undefined : value
  )
  .min(0.001, 'Net weight must be greater than 0')
  .optional();

// Display unit ID validation
export const displayUnitIdRule = string()
  .optional();

// Unit quantity validation
export const unitQtyRule = number()
  .transform((value, originalValue) =>
    String(originalValue).trim() === '' ? undefined : value
  )
  .min(0.001, 'Unit quantity must be greater than 0')
  .optional();

// Default unit validation (symbol)
export const defaultUnitRule = string()
  .max(10, 'Unit symbol cannot exceed 10 characters')
  .optional();

// Category IDs validation
export const categoryIdsRule = array()
  .of(string().required())
  .optional();

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
    })
  )
  .optional();

// Vendor/Brand name validation
export const vendorRule = string()
  .max(100, 'Vendor name cannot exceed 100 characters')
  .optional();

// Tags validation (array of strings)
export const tagsRule = array()
  .of(string().trim().max(30, 'Each tag cannot exceed 30 characters'))
  .max(10, 'Cannot have more than 10 tags')
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
    })
  )
  .optional();

// --- Create Item validation schema -------------------------------------------

export const createItemSchema = object({
  // Basic Information (required)
  name: itemNameRule,

  // Basic Information (optional)
  description: descriptionRule.nullable(),
  upc: upcRule,
  sku: skuRule,

  // Weight and Units
  netWeight: netWeightRule,
  displayUnitId: displayUnitIdRule,

  // Product Details
  type: string().nullable().optional(),
  storageState: string().nullable().optional(),
  shelfLifeDays: shelfLifeDaysRule,
  baseDimension: string().nullable().optional(),
  defaultConsumeIncrement: number()
    .transform((value, originalValue) =>
      String(originalValue).trim() === '' ? undefined : value
    )
    .min(0.001, 'Must be greater than 0')
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

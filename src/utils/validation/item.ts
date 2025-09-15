import * as yup from 'yup';

// --- item-specific validation rules ------------------------------------------

// Item name validation
export const itemNameRule = yup
  .string()
  .required('Item name is required')
  .min(1, 'Item name cannot be empty')
  .max(100, 'Item name cannot exceed 100 characters')
  .matches(
    /^[a-zA-Z0-9\s\-_'.,()&]+$/,
    'Item name can only contain letters, numbers, spaces, and common punctuation',
  );

// Description validation
export const descriptionRule = yup
  .string()
  .max(500, 'Description cannot exceed 500 characters')
  .optional();

// UPC validation (replaces barcode)
export const upcRule = yup
  .string()
  .matches(/^[0-9]+$/, 'UPC must contain only numbers')
  .min(8, 'UPC must be at least 8 digits')
  .max(18, 'UPC cannot exceed 18 digits')
  .optional();

export const skuRule = yup
  .string()
  .max(50, 'SKU cannot exceed 50 characters')
  .optional();

// URL validation
export const urlRule = yup.string().url('Please enter a valid URL').optional();

// Shelf life validation (in days)
export const shelfLifeDaysRule = yup
  .number()
  .integer('Must be a whole number')
  .min(1, 'Shelf life must be at least 1 day')
  .max(3650, 'Shelf life cannot exceed 10 years')
  .optional();

// Display item size validation
export const displayItemSizeRule = yup
  .string()
  .max(50, 'Display size cannot exceed 50 characters')
  .optional();

// Display price per unit validation
export const displayPricePerUnitRule = yup
  .string()
  .max(50, 'Display price per unit cannot exceed 50 characters')
  .optional();

// Net weight validation
export const netWeightRule = yup
  .number()
  .min(0.001, 'Net weight must be greater than 0')
  .optional();

// Display unit ID validation
export const displayUnitIdRule = yup
  .string()
  .optional();

// Unit quantity validation
export const unitQtyRule = yup
  .number()
  .min(0.001, 'Unit quantity must be greater than 0')
  .optional();

// Default unit validation (symbol)
export const defaultUnitRule = yup
  .string()
  .max(10, 'Unit symbol cannot exceed 10 characters')
  .optional();

// Category IDs validation
export const categoryIdsRule = yup
  .array()
  .of(yup.string().required())
  .optional();

// Units array validation
export const unitsRule = yup
  .array()
  .of(
    yup.object({
      unitId: yup.string().required(),
      isDefault: yup.boolean().default(false),
      packageSize: yup.number().min(0.001).required(),
      packageDescription: yup.string().optional(),
      conversionRatio: yup.number().min(0.001).optional(),
    })
  )
  .optional();

// Vendor/Brand name validation
export const vendorRule = yup
  .string()
  .max(100, 'Vendor name cannot exceed 100 characters')
  .optional();

// Tags validation (array of strings)
export const tagsRule = yup
  .array()
  .of(yup.string().trim().max(30, 'Each tag cannot exceed 30 characters'))
  .max(10, 'Cannot have more than 10 tags')
  .optional();

// --- Create Item validation schema -------------------------------------------

export const createItemSchema = yup.object({
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
  type: yup.string().nullable().optional(),
  storageState: yup.string().nullable().optional(),
  shelfLifeDays: shelfLifeDaysRule,

  // Images
  imageUrl: urlRule,

  // Brand Information
  brandId: yup.string().optional(),
  vendor: vendorRule,

  // Categories
  categoryIds: categoryIdsRule,

  // Units
  units: unitsRule,
  unitQty: unitQtyRule,
  defaultUnit: defaultUnitRule,

  // Metadata
  tags: tagsRule,

  // Boolean flags
  isFoodStampItem: yup.boolean().optional(),
  isFsaEligible: yup.boolean().optional(),
});

export type CreateItemFormData = yup.InferType<typeof createItemSchema>;

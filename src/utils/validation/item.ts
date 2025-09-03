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

// Barcode validation
export const barcodeRule = yup
  .string()
  .matches(/^[0-9]+$/, 'Barcode must contain only numbers')
  .min(8, 'Barcode must be at least 8 digits')
  .max(18, 'Barcode cannot exceed 18 digits')
  .optional();

// SKU validation
export const skuRule = yup
  .string()
  .max(50, 'SKU cannot exceed 50 characters')
  .optional();

// FDC ID validation
export const fdcIdRule = yup
  .string()
  .max(20, 'FDC ID cannot exceed 20 characters')
  .optional();

// URL validation
export const urlRule = yup.string().url('Please enter a valid URL').optional();

// Price validation (up to 2 decimal places)
export const priceRule = yup
  .number()
  .min(0, 'Price must be zero or positive')
  .test('decimal-places', 'Price can have at most 2 decimal places', value => {
    if (value == null) return true;
    return Number(value.toFixed(2)) === value;
  })
  .optional();

// Unit price validation
export const unitPriceRule = yup
  .number()
  .min(0, 'Unit price must be zero or positive')
  .test(
    'decimal-places',
    'Unit price can have at most 2 decimal places',
    value => {
      if (value == null) return true;
      return Number(value.toFixed(2)) === value;
    },
  )
  .optional();

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

// Popularity score validation
export const popularityRule = yup
  .number()
  .integer('Popularity must be a whole number')
  .min(0, 'Popularity must be zero or positive')
  .max(100, 'Popularity cannot exceed 100')
  .optional();

// External ID validation
export const externalIdRule = yup
  .string()
  .max(100, 'External ID cannot exceed 100 characters')
  .optional();

// Product location validation
export const productLocationRule = yup
  .string()
  .max(100, 'Product location cannot exceed 100 characters')
  .optional();

// Inventory status validation
export const inventoryStatusRule = yup
  .string()
  .max(50, 'Inventory status cannot exceed 50 characters')
  .optional();

// Health claims validation
export const healthClaimsRule = yup
  .array()
  .of(
    yup
      .string()
      .trim()
      .max(100, 'Each health claim cannot exceed 100 characters'),
  )
  .max(20, 'Cannot have more than 20 health claims')
  .optional();

// Fulfillment methods validation
export const fulfillmentMethodsRule = yup
  .array()
  .of(
    yup
      .string()
      .trim()
      .max(50, 'Each fulfillment method cannot exceed 50 characters'),
  )
  .max(10, 'Cannot have more than 10 fulfillment methods')
  .optional();

// Last synced at validation (ISO string)
export const lastSyncedAtRule = yup
  .string()
  .matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    'Must be a valid ISO date string',
  )
  .optional();

// --- Create Item validation schema -------------------------------------------

export const createItemSchema = yup.object({
  // Basic Information (required)
  name: itemNameRule,

  // Basic Information (optional)
  description: descriptionRule.nullable(),
  barcode: barcodeRule,
  sku: skuRule,
  fdcId: fdcIdRule,

  // Product Details
  type: yup.string().nullable().optional(),
  storageState: yup.string().nullable().optional(),
  shelfLifeDays: shelfLifeDaysRule,
  displayItemSize: displayItemSizeRule,

  // System fields
  dataSource: yup.string().nullable().optional(),
  status: yup.string().nullable().optional(),
  visibility: yup.string().nullable().optional(),

  // Images
  imageUrl: urlRule,

  // Pricing
  price: priceRule,
  averagePrice: priceRule,
  minPrice: priceRule,
  maxPrice: priceRule,
  unitPrice: unitPriceRule,
  displayPricePerUnit: displayPricePerUnitRule,
  comparedPrice: priceRule,

  // Brand Information
  brandId: yup.string().optional(),
  vendor: vendorRule,

  // Units
  unitQty: unitQtyRule,
  defaultUnit: defaultUnitRule,

  // Metadata
  tags: tagsRule,
  popularity: popularityRule,

  // Store-specific
  inventoryStatus: inventoryStatusRule,
  fulfillmentMethods: fulfillmentMethodsRule,
  productLocation: productLocationRule,

  // Additional metadata
  healthClaims: healthClaimsRule,

  // Tracking
  externalId: externalIdRule,
  lastSyncedAt: lastSyncedAtRule,

  // Boolean flags
  showInOnboarding: yup.boolean().optional(),
  isFoodStampItem: yup.boolean().optional(),
  isFsaEligible: yup.boolean().optional(),
});

export type CreateItemFormData = yup.InferType<typeof createItemSchema>;

import { object, string } from 'yup';
import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';

export type PageName = 'Basics' | 'Product' | 'Storage' | 'Inventory';

export const PAGES: readonly PageName[] = [
  'Basics',
  'Product',
  'Storage',
  'Inventory',
];

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
  itemName: string().required('Item name is required'),
  quantityInput: string().required('Quantity is required'),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  netWeight: string(),
  netWeightUnit: string(),
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
  quantityInput: string().required('Quantity is required'),
  unit: string(), // Tracking unit
  minQuantity: string(),
  restockQuantity: string(),
  netWeight: string(),
  netWeightUnit: string(),
  netWeightUnitId: string(),
  storageState: string().oneOf(Object.values(StorageState)),
  condition: string().oneOf(Object.values(ItemCondition)),
  location: string(),
  notes: string(),
  category: string(),
  brand: string(),
});

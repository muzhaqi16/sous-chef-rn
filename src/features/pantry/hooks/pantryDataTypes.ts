/**
 * Shared types for pantry management hooks
 */

import { StorageState } from '#/graphql/generated/schemaTypes';

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId: string;
  autoReorderPoint?: number;
  storageState: StorageState;
  location?: string;
  expirationDate?: string;
  notes?: string;
  category?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PantryItemUpdate extends Partial<PantryItemInput> {
  quantity?: number;
}

export interface PantryStats {
  total: number;
  expired: number;
  expiringSoon: number;
  lowStock: number;
}

export interface LocationCounts {
  all: number;
  fridge: number;
  freezer: number;
  pantry: number;
  /** Items with no storage state chosen — not the same as shelf-stable. */
  unassigned: number;
  // Custom storage location counts are added dynamically
  [key: string]: number;
}

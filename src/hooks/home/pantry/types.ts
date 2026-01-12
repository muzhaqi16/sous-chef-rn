/**
 * Shared types for pantry management hooks
 */

import { StorageState } from '#generated';

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
}

export interface SectionedItems {
  expiredItems: any[];
  expiringSoonItems: any[];
  normalItems: any[];
}

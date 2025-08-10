export interface ShoppingListItemDetail {
  id: string;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  unitId?: string;
  unitName?: string;
  isPurchased: boolean;
  estimatedPrice?: number;
  notes?: string;
  category?: string;
  priority?: number;
  item?: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    barcode?: string;
  };
  unit?: {
    id: string;
    name: string;
    symbol: string;
  };
}

/**
 * Where a scan was started from, and so what a result does: stock a pantry item
 * or add a shopping list line. It travels as a route param, so it is a string
 * rather than a callback — and it names the two features barcode serves, which
 * is why it lives HERE rather than in the shared navigation types.
 */
export type BarcodeSource = 'pantry' | 'shoppingList';

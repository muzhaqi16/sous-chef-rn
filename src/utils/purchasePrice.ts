/**
 * Shopping-list purchase price conversions.
 *
 * On the API, a shopping list item's `purchasedPrice` is a PER-UNIT amount:
 * the server records `Purchase.totalPrice = purchasedPrice × purchasedQuantity`
 * (`ShoppingListItemCRUDService.assemblePurchaseData`), and
 * `MoveShoppingItemToPantryInput.actualPrice` documents it as the per-unit price
 * it is derived from. The Mark Purchased sheet asks for the TOTAL the shopper
 * paid — the number on the receipt — so the conversion happens here, at the
 * boundary between what the user typed and what the API stores.
 */

/**
 * Per-unit price to send as `purchasedPrice` for a total the shopper paid.
 *
 * Deliberately NOT rounded to cents. The server rounds the product, not the
 * factor, so an unrounded unit price reproduces the entered total exactly
 * (10 / 3 × 3 → 10.00) where a cent-rounded 3.33 × 3 would record 9.99.
 */
export const unitPriceFromTotal = (
  total: number | null,
  quantity: number,
): number | null => {
  if (total == null) return null;
  return quantity > 0 ? total / quantity : total;
};

/**
 * Total to pre-fill the sheet from a per-unit estimate. Rounded to cents so the
 * input shows `14.97`, not the `14.969999999999999` that 4.99 × 3 produces in
 * floating point (`formatNumberForInput` is `String(value)`).
 */
export const totalFromUnitPrice = (
  unitPrice: number | null,
  quantity: number,
): number | null => {
  if (unitPrice == null) return null;
  const total = quantity > 0 ? unitPrice * quantity : unitPrice;
  return Math.round(total * 100) / 100;
};

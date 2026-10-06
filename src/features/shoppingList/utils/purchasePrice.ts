/**
 * The list's per-unit prices (`estimatedPrice`, `purchasedPrice`) are recorded
 * as `total = price × quantity`, while Mark Purchased and the move sheet ask
 * for the TOTAL paid. The conversion between the two lives here.
 */

/**
 * Deliberately NOT rounded to cents: the server rounds the product, not the
 * factor, so 10/3 × 3 records 10.00 where a rounded 3.33 × 3 records 9.99.
 */
export const unitPriceFromTotal = (
  total: number | null,
  quantity: number,
): number | null => {
  if (total == null) return null;
  return quantity > 0 ? total / quantity : total;
};

/**
 * Rounded to cents so the input shows `14.97`, not the 14.969999999999999 that
 * 4.99 × 3 produces (`formatNumberForInput` is `String(value)`).
 */
export const totalFromUnitPrice = (
  unitPrice: number | null,
  quantity: number,
): number | null => {
  if (unitPrice == null) return null;
  const total = quantity > 0 ? unitPrice * quantity : unitPrice;
  return Math.round(total * 100) / 100;
};

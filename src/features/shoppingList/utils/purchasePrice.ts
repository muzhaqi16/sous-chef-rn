/**
 * The list's per-unit prices (`estimatedPrice`, `purchasedPrice`) are recorded
 * as `total = price × quantity`, while Mark Purchased and the move sheet ask
 * for the TOTAL paid. The conversion between the two lives here.
 */

import type { DeepPartial } from '@apollo/client/utilities';
import type { PriceSuggestion } from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';

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
 * A per-unit price times the line's quantity (a line with none counts once),
 * as the API's `suggestedTotal` adds lines up. Rounded to cents so the input
 * shows `14.97`, not the 14.969999999999999 that 4.99 × 3 produces.
 */
export const lineTotal = (unitPrice: number, quantity: number): number =>
  Math.round((quantity > 0 ? unitPrice * quantity : unitPrice) * 100) / 100;

export const totalFromUnitPrice = (
  unitPrice: number | null,
  quantity: number,
): number | null => (unitPrice == null ? null : lineTotal(unitPrice, quantity));

/** A typed total's per-unit split, or null where it is the total (quantity 1). */
export const shownUnitPrice = (
  total: number | null | undefined,
  quantity: number | null,
): number | null =>
  total != null && quantity != null && quantity > 0 && quantity !== 1
    ? unitPriceFromTotal(total, quantity)
    : null;

/** What a line still to buy costs at its suggestion, which is per one unit. */
export const suggestedLineCost = (
  suggestion: DeepPartial<PriceSuggestion> | null | undefined,
  quantity: number,
): string | null =>
  suggestion?.amount != null && suggestion.currency?.code
    ? formatCurrency(
        lineTotal(suggestion.amount, quantity),
        suggestion.currency.code,
        suggestion.currency.decimalPlaces,
      )
    : null;

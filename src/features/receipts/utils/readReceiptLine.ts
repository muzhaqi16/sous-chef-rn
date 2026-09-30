export interface ReceiptLineReading {
  /** The line's own amount, negative for a discount. */
  amount?: number;
  /** A product code (UPC, PLU or a store's item number): 4–14 digits. */
  code?: string;
  /** From `2 @ 1.99` or `2.14 lb @ 0.59 /lb`. */
  quantity?: number;
  /** The weight unit of a weighed line; a count has none. */
  unit?: string;
  unitPrice?: number;
}

const toNumber = (text: string) => Number(text.replace(',', '.'));

// `2 @ 1.99`, `2.14 lb @ 0.59 /lb`, `3 @ 2/5.00` is not read (a deal, not a price).
const QUANTITY_AT_PRICE =
  /(\d+(?:[.,]\d+)?)\s*(lbs?|kg|oz|g)?\s*@\s*\$?(\d+[.,]\d{2})(?!\d)\s*(?:\/\s*(?:lbs?|kg|oz|g|ea))?/i;

// The last money figure on the line, followed only by tax flags (`F`, `N`,
// `KF`, `*`). A minus on either side marks a discount: `0.50-`, `-0.50`.
const TRAILING_AMOUNT =
  /(-)?\$?(\d{1,6}[.,]\d{2})(-)?\s*(?:[A-Z]{1,2}|\*)?\s*$/i;

const CODE = /(?<![\d.,])\d{4,14}(?![\d.,])/;

/** What the line itself states; which line is which is decided elsewhere. */
export function readReceiptLine(text: string): ReceiptLineReading {
  const reading: ReceiptLineReading = {};
  let rest = text;

  const perUnit = QUANTITY_AT_PRICE.exec(rest);
  if (perUnit) {
    const [match, quantity = '', unit, unitPrice = ''] = perUnit;
    reading.quantity = toNumber(quantity);
    reading.unitPrice = toNumber(unitPrice);
    if (unit) reading.unit = unit.toLowerCase().replace(/^lbs$/, 'lb');
    rest = rest.replace(match, ' ');
  }

  const trailing = TRAILING_AMOUNT.exec(rest);
  if (trailing) {
    const [match, leadingMinus, amount = '', trailingMinus] = trailing;
    const value = toNumber(amount);
    reading.amount = leadingMinus || trailingMinus ? -value : value;
    rest = rest.slice(0, rest.length - match.length);
  }

  const [code] = CODE.exec(rest) ?? [];
  if (code) reading.code = code;

  return reading;
}

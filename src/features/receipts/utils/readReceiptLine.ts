export interface ReceiptLineReading {
  /** The line's own amount, negative for a discount. */
  amount?: number;
  /** A product code (UPC, PLU or a store's item number): 4–14 digits. */
  code?: string;
  /** From `2 @ 1.99`, `2.14 lb @ 0.59 /lb` or `2.21 lb @ 1 lb /0.46`. */
  quantity?: number;
  /** The weight unit of a weighed line; a count has none. */
  unit?: string;
  unitPrice?: number;
}

const toNumber = (text: string) => Number(text.replace(',', '.'));

// `2 @ 1.99`, `2.54 lb @ .99/lb`, the UK's `2 x 2.19`; `3 @ 2/5.00` is not
// read (a deal, not a price).
const QUANTITY_AT_PRICE =
  /(\d+(?:[.,]\d+)?)\s*(lbs?|kg|oz|g)?\s*(?:@|[x×](?=\s))\s*\$?(\d*[.,]\d{2})(?!\d)\s*(?:\/\s*(?:lbs?|kg|oz|g|ea))?/i;

// Walmart weighs at a rate per one unit, `2.21 lb @ 1 lb /0.46`, which
// recognition reads as `2.21 lb. @ 1 1b. /0.46`.
const WEIGHT_AT_RATE =
  /(\d+(?:[.,]\d+)?)\s*([l1I]bs?|kg|oz|g)\.?\s*@\s*1\s*(?:[l1I]bs?|kg|oz|g)\.?\s*\/\s*\$?(\d*[.,]\d{2})(?!\d)/i;

// The last money figure on the line, followed only by tax flags (`F`, `N`,
// `KF`, `*`). A minus on either side marks a discount: `0.50-`, `-0.50`. A
// deal's price (`1 @ 2/3.00`) is not the line's.
const TRAILING_AMOUNT =
  /(?<![\d/$])(-)?\$?(\d{1,6}[.,]\d{2})(-)?\s*(?:[A-Z]{1,2}|\*)?\s*$/i;

const CODE = /(?<![\d.,])\d{4,14}(?![\d.,])/;

/** The line without its trailing amount and tax flags. */
export const withoutAmount = (text: string) =>
  text.replace(TRAILING_AMOUNT, '');

/** What the line itself states; which line is which is decided elsewhere. */
export function readReceiptLine(text: string): ReceiptLineReading {
  const reading: ReceiptLineReading = {};
  let rest = text;

  const perUnit = WEIGHT_AT_RATE.exec(rest) ?? QUANTITY_AT_PRICE.exec(rest);
  if (perUnit) {
    const [match, quantity = '', unit, unitPrice = ''] = perUnit;
    reading.quantity = toNumber(quantity);
    reading.unitPrice = toNumber(unitPrice);
    if (unit) reading.unit = unit.toLowerCase().replace(/^[l1i]bs?$/, 'lb');
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

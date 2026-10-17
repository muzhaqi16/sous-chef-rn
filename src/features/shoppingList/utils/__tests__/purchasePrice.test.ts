import {
  shownUnitPrice,
  suggestedLineCost,
  totalFromUnitPrice,
  unitPriceFromTotal,
} from '#features/shoppingList/utils/purchasePrice';
import { formatCurrency } from '#/utils/formatters/number';

describe('unitPriceFromTotal', () => {
  it('divides the total paid by the quantity', () => {
    expect(unitPriceFromTotal(3, 2)).toBe(1.5);
  });

  it('passes an unknown price through', () => {
    expect(unitPriceFromTotal(null, 2)).toBeNull();
  });

  it('leaves the total alone when the quantity cannot divide it', () => {
    expect(unitPriceFromTotal(3, 0)).toBe(3);
  });

  it('is not rounded, so the server-side product lands on the entered total', () => {
    const unit = unitPriceFromTotal(10, 3);
    // What the API does: roundMoney(unitPrice * quantity).
    expect(Math.round(unit! * 3 * 100) / 100).toBe(10);
    // A cent-rounded unit price would have lost a cent.
    expect(Math.round(3.33 * 3 * 100) / 100).toBe(9.99);
  });
});

describe('totalFromUnitPrice', () => {
  it('multiplies the per-unit estimate by the quantity, rounded to cents', () => {
    expect(totalFromUnitPrice(4.99, 2)).toBe(9.98);
    expect(totalFromUnitPrice(4.99, 3)).toBe(14.97);
    expect(totalFromUnitPrice(1.25, 5)).toBe(6.25);
  });

  it('passes an unknown estimate through', () => {
    expect(totalFromUnitPrice(null, 2)).toBeNull();
  });

  it('uses the estimate as-is when there is no quantity to multiply by', () => {
    expect(totalFromUnitPrice(4.99, 0)).toBe(4.99);
  });
});

describe('shownUnitPrice', () => {
  it('splits a total across a quantity other than one', () => {
    expect(shownUnitPrice(3, 2)).toBe(1.5);
  });

  it.each([
    ['one, where the split is the total', 3, 1],
    ['an unusable quantity', 3, 0],
    ['no quantity', 3, null],
    ['no total', null, 2],
  ])('shows nothing for %s', (_case, total, quantity) => {
    expect(shownUnitPrice(total, quantity)).toBeNull();
  });
});

describe('suggestedLineCost', () => {
  it("prices the line's quantity at its suggestion, in the suggestion's currency", () => {
    expect(
      suggestedLineCost(
        { amount: 4.99, currency: { code: 'EUR', decimalPlaces: 2 } },
        3,
      ),
    ).toBe(formatCurrency(14.97, 'EUR', 2));
  });

  it('is null without a suggestion or its currency', () => {
    expect(suggestedLineCost(null, 3)).toBeNull();
    expect(suggestedLineCost({ amount: 4.99 }, 3)).toBeNull();
  });
});

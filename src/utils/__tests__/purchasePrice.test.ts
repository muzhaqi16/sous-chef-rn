import { totalFromUnitPrice, unitPriceFromTotal } from '../purchasePrice';

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

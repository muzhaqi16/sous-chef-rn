import type {
  ParsedLineKind,
  ParsedReceipt,
  ParsedReceiptLine,
} from '../structureReceipt';
import { receiptTotalsGap } from '../receiptTotalsGap';

type Line = Omit<ParsedReceiptLine, 'index'>;

const receipt = (...lines: Line[]): ParsedReceipt => ({
  lines: lines.map((line, index) => ({ ...line, index })),
});

const line = (kind: ParsedLineKind, rawText: string, lineTotal?: number) =>
  lineTotal === undefined ? { rawText, kind } : { rawText, kind, lineTotal };

describe('receiptTotalsGap', () => {
  it('finds nothing when the items add up to the subtotal', () => {
    expect(
      receiptTotalsGap(
        receipt(
          line('other', 'WALMART'),
          line('item', 'GV WHOLE MILK 3.48', 3.48),
          line('item', 'BNLS SKNLS CHKN 11.97', 11.97),
          line('item', 'BANANAS 1.24', 1.24),
          line('subtotal', 'SUBTOTAL 16.69', 16.69),
          line('tax', 'TAX 0.00', 0),
          line('total', 'TOTAL 16.69', 16.69),
          line('other', 'CHANGE DUE 0.00', 0),
        ),
      ),
    ).toBeNull();
  });

  it('reports a line that was not read', () => {
    expect(
      receiptTotalsGap(
        receipt(
          line('item', 'GV WHOLE MILK 3.48', 3.48),
          line('item', 'BANANAS 1.24', 1.24),
          line('subtotal', 'SUBTOTAL 16.69', 16.69),
        ),
      ),
    ).toEqual({ counted: 4.72, printed: 16.69 });
  });

  it('takes discounts off and counts a fee printed among the items', () => {
    expect(
      receiptTotalsGap(
        receipt(
          line('item', 'KRO WHL MILK 3.29', 3.29),
          line('discount', 'SC SAVINGS 0.50-', -0.5),
          line('discount', 'COUPON 0.30', 0.3),
          line('other', 'BAG FEE 0.10', 0.1),
          line('subtotal', 'SUBTOTAL 2.59', 2.59),
        ),
      ),
    ).toBeNull();
  });

  it('reads the total less tax when no subtotal is printed', () => {
    const bread = line('item', 'BREAD 3.98', 3.98);
    const tax = line('tax', 'TAX 0.24', 0.24);
    expect(
      receiptTotalsGap(
        receipt(bread, tax, line('total', 'BALANCE 4.22', 4.22)),
      ),
    ).toBeNull();
    expect(
      receiptTotalsGap(
        receipt(bread, tax, line('total', 'BALANCE 6.22', 6.22)),
      ),
    ).toEqual({ counted: 3.98, printed: 5.98 });
  });

  it('says nothing when the receipt prints no total to check against', () => {
    expect(
      receiptTotalsGap(receipt(line('item', 'BREAD 3.98', 3.98))),
    ).toBeNull();
  });
});

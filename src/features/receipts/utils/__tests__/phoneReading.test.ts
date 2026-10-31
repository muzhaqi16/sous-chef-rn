import { readOnPhone } from '../phoneReading';

const TODAY = '2026-10-30';

const itemsOf = (lines: readonly string[]) =>
  readOnPhone([lines.join('\n')], TODAY, 'monthFirst')
    ?.parsed.lines.filter(line => line.kind === 'item')
    .map(({ product, code }) => ({ product, code: code ?? null }));

describe('a barcode text recognition split', () => {
  it('reads whole, its digits out of the name, beside codes that prove its length', () => {
    expect(
      itemsOf([
        'MAPLE ROW MARKET',
        'SOAP BAR 001234567890 F 2.00',
        'DISH RAG 009876543210 3.00',
        'BLUE TOWEL 019283746 50 1 7.00',
        'CANDY o0120o034560 F 1.50',
        'SILVER CARD 0712345 67890 2.50',
        'SUBTOTAL 16.00',
        'TOTAL 16.00',
      ]),
    ).toEqual([
      { product: 'SOAP BAR', code: '001234567890' },
      { product: 'DISH RAG', code: '009876543210' },
      { product: 'BLUE TOWEL', code: '019283746501' },
      { product: 'CANDY', code: '001200034560' },
      { product: 'SILVER CARD', code: '071234567890' },
    ]);
  });

  it('is no code at all with nothing to prove its length, never a fragment', () => {
    expect(
      itemsOf([
        'MAPLE ROW MARKET',
        'BLUE TOWEL 019283746 50 1 7.00',
        'TOTAL 7.00',
      ]),
    ).toEqual([{ product: 'BLUE TOWEL', code: null }]);
  });
});

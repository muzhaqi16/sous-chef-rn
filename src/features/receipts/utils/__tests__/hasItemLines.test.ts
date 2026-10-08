import { hasItemLines } from '../hasItemLines';

describe('hasItemLines', () => {
  it('finds a line with a word and an amount on any page', () => {
    expect(hasItemLines([['WALMART'], ['GV WHOLE MILK  3.48 N']])).toBe(true);
    expect(hasItemLines([['LATTE  4,50']])).toBe(true);
  });

  it('reports a blurry scan: no text, or text with no amount', () => {
    expect(hasItemLines([])).toBe(false);
    expect(hasItemLines([[], []])).toBe(false);
    expect(hasItemLines([['WALMART', 'THANK YOU', '12/09/26 14:43']])).toBe(
      false,
    );
  });
});

import type { ReceiptLineChoice } from '../../store/receiptDraftStore';
import { linkReceiptLines, type OpenListLine } from '../linkReceiptLines';

const choice = (
  itemId: string | null,
  unit: { id?: string; text?: string } = {},
  offList?: boolean,
): ReceiptLineChoice => ({
  itemId,
  itemName: itemId ?? 'typed',
  quantity: 1,
  unitId: unit.id ?? null,
  unitText: unit.text ?? '',
  price: null,
  ...(offList ? { offList } : {}),
});

const LB = { id: 'u-lb', name: 'pound', symbol: 'lb' };
const listLine = (
  id: string,
  itemId: string,
  unit: OpenListLine['unit'] = null,
): OpenListLine => ({ id, item: { id: itemId }, unit });

const linked = (
  chosen: { index: number; choice: ReceiptLineChoice }[],
  lines: OpenListLine[],
) =>
  Object.fromEntries(
    [...linkReceiptLines(chosen, lines)].map(([index, line]) => [
      index,
      line.id,
    ]),
  );

describe('linkReceiptLines', () => {
  it('links a line to the open list line for the same catalog item', () => {
    expect(
      linked(
        [
          { index: 2, choice: choice('cat-milk') },
          { index: 4, choice: choice('cat-bread') },
          { index: 5, choice: choice(null) },
        ],
        [listLine('l-eggs', 'cat-eggs'), listLine('l-milk', 'cat-milk')],
      ),
    ).toEqual({ 2: 'l-milk' });
  });

  it('links only where the unit fits: the same unit, or none stated', () => {
    const bananas = listLine('l-bananas', 'cat-bananas', LB);
    expect(
      linked(
        [{ index: 0, choice: choice('cat-bananas', { id: 'u-kg' }) }],
        [bananas],
      ),
    ).toEqual({});
    expect(
      linked(
        [
          { index: 0, choice: choice('cat-bananas', { text: 'LB' }) },
          { index: 1, choice: choice('cat-bananas', { id: 'u-lb' }) },
        ],
        [bananas, listLine('l-bananas-2', 'cat-bananas')],
      ),
    ).toEqual({ 0: 'l-bananas', 1: 'l-bananas-2' });
  });

  it('gives each list line to one receipt line, the first in receipt order', () => {
    expect(
      linked(
        [
          { index: 1, choice: choice('cat-milk') },
          { index: 3, choice: choice('cat-milk') },
        ],
        [listLine('l-milk', 'cat-milk')],
      ),
    ).toEqual({ 1: 'l-milk' });
  });

  it('leaves the list line for the next match when a line is kept off the list', () => {
    expect(
      linked(
        [
          { index: 1, choice: choice('cat-milk', {}, true) },
          { index: 3, choice: choice('cat-milk') },
        ],
        [listLine('l-milk', 'cat-milk')],
      ),
    ).toEqual({ 3: 'l-milk' });
  });
});

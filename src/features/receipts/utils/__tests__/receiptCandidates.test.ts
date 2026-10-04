import { ReceiptMatchMethod } from '#/graphql/generated/schemaTypes';
import type { ReceiptCandidate } from '../../hooks/useReceiptMatches';
import { detailBesideName } from '../receiptCandidates';

const candidate = (
  itemId: string,
  itemName: string,
  detail: string | null,
): ReceiptCandidate => ({
  itemId,
  itemName,
  detail,
  method: ReceiptMatchMethod.Search,
});

describe('detailBesideName', () => {
  const kirkland = candidate('milk-1', 'Whole milk', 'Kirkland');
  const horizon = candidate('milk-2', 'Whole milk', 'Horizon');
  const bananas = candidate('bananas', 'Bananas', 'Dole');

  it('shows the detail when another candidate shares the name', () => {
    const all = [kirkland, horizon, bananas];
    expect(detailBesideName(kirkland, all)).toBe('Kirkland');
    expect(detailBesideName(horizon, all)).toBe('Horizon');
  });

  it('keeps a name no other candidate has bare', () => {
    expect(detailBesideName(bananas, [kirkland, horizon, bananas])).toBeNull();
  });

  it('has nothing to add for an item with no detail', () => {
    const generic = candidate('milk-3', 'Whole milk', null);
    expect(detailBesideName(generic, [kirkland, generic])).toBeNull();
  });
});

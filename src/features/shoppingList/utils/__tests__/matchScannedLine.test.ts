import { matchScannedLine } from '../matchScannedLine';

const line = (id: string, itemId: string | null) => ({
  id,
  item: itemId ? { id: itemId } : null,
});

const JIF = { id: 'jif-creamy', conceptIds: ['creamy-pb', 'peanut-butter'] };

describe('matchScannedLine', () => {
  it('ticks the line naming the scanned product first', () => {
    const toBuy = [
      line('generic', 'peanut-butter'),
      line('exact', 'jif-creamy'),
    ];

    expect(matchScannedLine(toBuy, [], JIF)).toEqual({
      line: toBuy[1],
      inCart: false,
    });
  });

  it('falls back to the nearest concept above the product', () => {
    const toBuy = [
      line('generic', 'peanut-butter'),
      line('creamy', 'creamy-pb'),
    ];

    expect(matchScannedLine(toBuy, [], JIF)?.line.id).toBe('creamy');
  });

  it('matches a line naming a concept further up', () => {
    const toBuy = [line('milk', 'milk'), line('generic', 'peanut-butter')];

    expect(matchScannedLine(toBuy, [], JIF)?.line.id).toBe('generic');
  });

  it('reports a line already in the cart only when none is left to buy', () => {
    const cart = [line('bought', 'peanut-butter')];

    expect(matchScannedLine([], cart, JIF)).toEqual({
      line: cart[0],
      inCart: true,
    });
    expect(
      matchScannedLine([line('open', 'creamy-pb')], cart, JIF),
    ).toMatchObject({ inCart: false });
  });

  it('matches nothing for a product the list does not name', () => {
    expect(
      matchScannedLine([line('milk', 'milk'), line('inline', null)], [], JIF),
    ).toBeNull();
  });
});

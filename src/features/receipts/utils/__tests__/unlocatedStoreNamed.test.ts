import { unlocatedStoreNamed, type HeldStore } from '../unlocatedStoreNamed';

const label = (id: string, name: string): HeldStore => ({
  id,
  name,
  address: null,
  storeNumber: null,
});
const branch = (id: string, name: string, address: string): HeldStore => ({
  id,
  name,
  address,
  storeNumber: null,
});

describe('unlocatedStoreNamed', () => {
  it('offers the store with no address named as the receipt, however it is written', () => {
    expect(
      unlocatedStoreNamed(
        ['GIANT EAGLE'],
        [branch('s-1', 'Kroger', '1 Main St'), label('s-2', 'Giant Eagle')],
      ),
    ).toEqual({ id: 's-2', name: 'Giant Eagle' });
  });

  it("offers the one named as the receipt's chain", () => {
    expect(
      unlocatedStoreNamed(
        ['GIANT EAGLE MARKET DISTRICT', 'Giant Eagle'],
        [label('s-2', 'giant eagle')],
      ),
    ).toEqual({ id: 's-2', name: 'giant eagle' });
  });

  // A branch the household knows only by its number is located all the same.
  it('offers no store that has a number', () => {
    expect(
      unlocatedStoreNamed(
        ['Giant Eagle'],
        [{ ...label('s-4', 'Giant Eagle'), storeNumber: '1619' }],
      ),
    ).toBeNull();
  });

  it('offers no store that has an address: it is located already', () => {
    expect(
      unlocatedStoreNamed(
        ['Giant Eagle'],
        [branch('s-3', 'Giant Eagle', '5990 Baum Blvd')],
      ),
    ).toBeNull();
  });

  it('counts a blank address as none', () => {
    expect(
      unlocatedStoreNamed(
        ['Giant Eagle'],
        [branch('s-2', 'Giant Eagle', '  ')],
      ),
    ).toEqual({ id: 's-2', name: 'Giant Eagle' });
  });

  it('offers none when two stores have the name', () => {
    expect(
      unlocatedStoreNamed(
        ['Giant Eagle'],
        [label('s-2', 'Giant Eagle'), label('s-4', 'GIANT EAGLE')],
      ),
    ).toBeNull();
  });

  it('counts a store held twice, by two sources, once', () => {
    expect(
      unlocatedStoreNamed(
        ['Giant Eagle'],
        [label('s-2', 'Giant Eagle'), label('s-2', 'Giant Eagle')],
      ),
    ).toEqual({ id: 's-2', name: 'Giant Eagle' });
  });

  it('offers none for another shop, or a receipt with no name', () => {
    const held = [label('s-2', 'Giant Eagle')];
    expect(unlocatedStoreNamed(['Giant Eagle Express'], held)).toBeNull();
    expect(unlocatedStoreNamed([undefined, null, ' ', '—'], held)).toBeNull();
  });

  it('never offers a store whose name has no letter or digit', () => {
    expect(unlocatedStoreNamed(['—'], [label('s-5', '·')])).toBeNull();
  });
});

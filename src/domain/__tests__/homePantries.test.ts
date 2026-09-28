import { defaultPantryOf } from '../homePantries';

const home = (...pantries: Array<{ id: string; isDefault: boolean }>) => ({
  pantriesConnection: { edges: pantries.map(node => ({ node })) },
});

describe('defaultPantryOf', () => {
  it('opens on the pantry marked default', () => {
    expect(
      defaultPantryOf(
        home({ id: 'p-1', isDefault: false }, { id: 'p-2', isDefault: true }),
      )?.id,
    ).toBe('p-2');
  });

  it('falls back to the first pantry when none is marked', () => {
    expect(
      defaultPantryOf(
        home({ id: 'p-1', isDefault: false }, { id: 'p-2', isDefault: false }),
      )?.id,
    ).toBe('p-1');
  });

  it.each([
    ['no pantries', home()],
    ['no connection', {}],
    ['no home', null],
    ['an unread home', undefined],
  ])('has nothing to open on with %s', (_, input) => {
    expect(defaultPantryOf(input)).toBeUndefined();
  });
});

import { filterByTerm, identity, matchesTerm } from '../useLocalSearch';

type Row = { name: string; description?: string | null; count?: number };

const rows: Row[] = [
  { name: 'Tomato', description: 'Red and round' },
  { name: 'Bread', description: null },
  { name: 'Milk' },
];

describe('filterByTerm', () => {
  it('matches a substring, case-insensitively', () => {
    expect(filterByTerm(rows, 'TOMA', ['name'])).toEqual([rows[0]]);
  });

  it('matches on any of several keys', () => {
    expect(filterByTerm(rows, 'round', ['name', 'description'])).toEqual([
      rows[0],
    ]);
  });

  it('returns the SAME array for an empty or whitespace term', () => {
    // Reference equality, not just contents: a new array on every keystroke is
    // what makes a list re-render when the search box is merely focused.
    expect(filterByTerm(rows, '', ['name'])).toBe(rows);
    expect(filterByTerm(rows, '   ', ['name'])).toBe(rows);
  });

  it('trims the term', () => {
    expect(filterByTerm(rows, '  milk  ', ['name'])).toEqual([rows[2]]);
  });

  it('treats a null or missing field as no match, not a crash', () => {
    expect(filterByTerm(rows, 'red', ['description'])).toEqual([rows[0]]);
  });

  it('does not match a non-string field by stringifying it', () => {
    const counted: Row[] = [{ name: 'a', count: 12 }];
    // '[object Object]' and '12' must not become searchable text.
    expect(filterByTerm(counted, '12', ['count'])).toEqual([]);
  });

  it('handles a null list', () => {
    expect(filterByTerm(null, 'x', ['name'])).toEqual([]);
    expect(filterByTerm(undefined, 'x', ['name'])).toEqual([]);
  });

  it('searches a list of plain strings through identity', () => {
    expect(filterByTerm(['alpha', 'beta'], 'BET', [identity])).toEqual([
      'beta',
    ]);
  });

  it('takes an accessor for a nested field', () => {
    const nested = [{ parent: { name: 'Fridge' } }, { parent: null }];
    expect(filterByTerm(nested, 'fri', [n => n.parent?.name])).toEqual([
      nested[0],
    ]);
  });
});

describe('matchesTerm', () => {
  it('is true for an empty term, so a compound filter falls through', () => {
    expect(matchesTerm(rows[0], '', ['name'])).toBe(true);
  });

  it('answers for one item', () => {
    expect(matchesTerm(rows[0], 'tom', ['name'])).toBe(true);
    expect(matchesTerm(rows[1], 'tom', ['name'])).toBe(false);
  });
});

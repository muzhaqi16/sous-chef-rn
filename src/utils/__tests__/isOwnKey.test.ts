import { isOwnKey } from '#utils/isOwnKey';

describe('isOwnKey', () => {
  const table = { firstName: 1, lastName: 2 };

  it('accepts a declared key', () => {
    expect(isOwnKey(table, 'firstName')).toBe(true);
  });

  it('rejects an absent key', () => {
    expect(isOwnKey(table, 'middleName')).toBe(false);
  });

  it('rejects an inherited name', () => {
    expect(isOwnKey(table, 'constructor')).toBe(false);
    expect(isOwnKey(table, 'toString')).toBe(false);
  });
});

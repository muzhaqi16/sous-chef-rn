import { getEffectiveUnit, getEffectiveUnitSymbol } from '../pantryItemUtils';

const gram = { id: '1', name: 'gram', symbol: 'g' };
const kilogram = { id: '2', name: 'kilogram', symbol: 'kg' };

describe('getEffectiveUnit', () => {
  it('returns undefined for null source', () => {
    expect(getEffectiveUnit(null)).toBeUndefined();
  });

  it('returns undefined for undefined source', () => {
    expect(getEffectiveUnit(undefined)).toBeUndefined();
  });

  it('returns the pantry item unit when present', () => {
    expect(getEffectiveUnit({ unit: gram })).toBe(gram);
  });

  it('falls back to item.displayUnit when unit is null', () => {
    expect(
      getEffectiveUnit({ unit: null, item: { displayUnit: kilogram } }),
    ).toBe(kilogram);
  });

  it('falls back to item.displayUnit when unit is undefined', () => {
    expect(
      getEffectiveUnit({ item: { displayUnit: kilogram } }),
    ).toBe(kilogram);
  });

  it('prefers unit over item.displayUnit', () => {
    expect(
      getEffectiveUnit({ unit: gram, item: { displayUnit: kilogram } }),
    ).toBe(gram);
  });

  it('returns undefined when both are null', () => {
    expect(
      getEffectiveUnit({ unit: null, item: { displayUnit: null } }),
    ).toBeUndefined();
  });

  it('returns undefined when item itself is null', () => {
    expect(getEffectiveUnit({ unit: null, item: null })).toBeUndefined();
  });
});

describe('getEffectiveUnitSymbol', () => {
  it('returns the unit symbol from pantry item unit', () => {
    expect(getEffectiveUnitSymbol({ unit: gram })).toBe('g');
  });

  it('returns the displayUnit symbol as fallback', () => {
    expect(
      getEffectiveUnitSymbol({ unit: null, item: { displayUnit: kilogram } }),
    ).toBe('kg');
  });

  it('returns undefined when no unit available', () => {
    expect(getEffectiveUnitSymbol(null)).toBeUndefined();
  });

  it('returns undefined for empty source', () => {
    expect(getEffectiveUnitSymbol({})).toBeUndefined();
  });
});

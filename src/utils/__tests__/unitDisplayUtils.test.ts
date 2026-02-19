import {
  getUnitDisplayName,
  formatQuantityWithUnit,
  findItemUnitById,
  findItemUnitBySymbol,
  getUnitChipLabel,
} from '../unitDisplayUtils';

describe('getUnitDisplayName', () => {
  it('returns singular display name for quantity 1', () => {
    const itemUnit = {
      displayNameSingular: 'pineapple',
      displayNamePlural: 'pineapples',
    };
    expect(getUnitDisplayName(1, itemUnit)).toBe('pineapple');
  });

  it('returns plural display name for quantity > 1', () => {
    const itemUnit = {
      displayNameSingular: 'pineapple',
      displayNamePlural: 'pineapples',
    };
    expect(getUnitDisplayName(2, itemUnit)).toBe('pineapples');
  });

  it('returns plural display name for quantity 0', () => {
    const itemUnit = {
      displayNameSingular: 'egg',
      displayNamePlural: 'eggs',
    };
    expect(getUnitDisplayName(0, itemUnit)).toBe('eggs');
  });

  it('falls back to unit symbol when no display names', () => {
    const itemUnit = { unit: { symbol: 'g' } };
    expect(getUnitDisplayName(1, itemUnit)).toBe('g');
    expect(getUnitDisplayName(2, itemUnit)).toBe('g');
  });

  it('falls back to fallbackSymbol when no itemUnit', () => {
    expect(getUnitDisplayName(2, null, 'count')).toBe('count');
  });

  it('returns empty string when nothing available', () => {
    expect(getUnitDisplayName(1, null, null)).toBe('');
  });

  it('returns empty string for undefined itemUnit', () => {
    expect(getUnitDisplayName(1, undefined)).toBe('');
  });
});

describe('formatQuantityWithUnit', () => {
  it('formats quantity with plural name', () => {
    const itemUnit = {
      displayNameSingular: 'pineapple',
      displayNamePlural: 'pineapples',
    };
    expect(formatQuantityWithUnit(2, itemUnit)).toBe('2 pineapples');
  });

  it('formats quantity with singular name', () => {
    const itemUnit = {
      displayNameSingular: 'egg',
      displayNamePlural: 'eggs',
    };
    expect(formatQuantityWithUnit(1, itemUnit)).toBe('1 egg');
  });

  it('formats with fallback symbol', () => {
    expect(formatQuantityWithUnit(500, null, 'g')).toBe('500 g');
  });

  it('returns just the number when no unit info', () => {
    expect(formatQuantityWithUnit(5, null, null)).toBe('5');
  });
});

describe('findItemUnitById', () => {
  const itemUnits = [
    { unit: { id: 'u1', symbol: 'g' } },
    { unit: { id: 'u2', symbol: 'kg' } },
  ];

  it('finds matching unit by ID', () => {
    expect(findItemUnitById('u2', itemUnits)).toBe(itemUnits[1]);
  });

  it('returns undefined for no match', () => {
    expect(findItemUnitById('u99', itemUnits)).toBeUndefined();
  });

  it('returns undefined for null unitId', () => {
    expect(findItemUnitById(null, itemUnits)).toBeUndefined();
  });

  it('returns undefined for null itemUnits', () => {
    expect(findItemUnitById('u1', null)).toBeUndefined();
  });
});

describe('findItemUnitBySymbol', () => {
  const itemUnits = [
    { unit: { symbol: 'g' } },
    { unit: { symbol: 'kg' } },
  ];

  it('finds matching unit by symbol (case-insensitive)', () => {
    expect(findItemUnitBySymbol('KG', itemUnits)).toBe(itemUnits[1]);
  });

  it('returns undefined for no match', () => {
    expect(findItemUnitBySymbol('oz', itemUnits)).toBeUndefined();
  });

  it('returns undefined for null symbol', () => {
    expect(findItemUnitBySymbol(null, itemUnits)).toBeUndefined();
  });
});

describe('getUnitChipLabel', () => {
  it('prefers plural display name', () => {
    expect(
      getUnitChipLabel({
        displayNamePlural: 'pineapples',
        unit: { symbol: 'count' },
      }),
    ).toBe('pineapples');
  });

  it('falls back to unit symbol', () => {
    expect(getUnitChipLabel({ unit: { symbol: 'g' } })).toBe('g');
  });

  it('falls back to unit name', () => {
    expect(getUnitChipLabel({ unit: { name: 'gram' } })).toBe('gram');
  });

  it('returns empty string when nothing available', () => {
    expect(getUnitChipLabel({})).toBe('');
  });
});

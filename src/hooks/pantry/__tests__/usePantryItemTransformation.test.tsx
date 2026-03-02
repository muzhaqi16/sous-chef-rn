'use no memo';

import { renderHook } from '@testing-library/react-native';
import {
  usePantryItemTransformation,
  formatStorageState,
  calculateExpiresIn,
  getLocation,
  getExpirationStatus,
  getCategoryEmoji,
  formatPackageBreakdown,
  formatPackageBreakdownFull,
  formatNetWeight,
  formatNetWeightDisplay,
  formatRemainingNetWeight,
  formatQuantityBreakdown,
} from '../usePantryItemTransformation';

// Mock dependencies
jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn((item: any) => item?.item?.imageUrl || null),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));

jest.mock('#generated', () => ({
  StorageState: {
    Refrigerated: 'REFRIGERATED',
    Frozen: 'FROZEN',
    Ambient: 'AMBIENT',
  },
}));

jest.mock('#/utils/formatQuantity', () => ({
  formatQuantityAsFraction: jest.fn((q: number) => String(q)),
}));

const mockTheme = {
  colors: {
    surface: '#ffffff',
    error: '#ff0000',
    warning: '#ffaa00',
    textSecondary: '#666666',
    textPrimary: '#000000',
  },
};

const makeItem = (overrides: any = {}) => ({
  id: 'item-1',
  itemName: 'Milk',
  quantity: 2,
  expiresAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  storageState: 'REFRIGERATED',
  storageLocation: null,
  item: null,
  unit: null,
  netWeight: null,
  remainingNetWeight: null,
  netWeightUnit: null,
  packageBreakdown: null,
  quantityBreakdown: null,
  ...overrides,
});

describe('usePantryItemTransformation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transforms items with basic data', () => {
    const items = [makeItem()];
    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('item-1');
    expect(result.current[0].title).toBe('Milk');
    expect(result.current[0].quantity).toBe(2);
  });

  it('filters out items with missing IDs', () => {
    const items = [makeItem(), makeItem({ id: '' }), makeItem({ id: 'item-3' })];
    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current).toHaveLength(2);
  });

  it('adds expired badge for expired items', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const items = [makeItem({ expiresAt: yesterday.toISOString() })];

    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current[0].badge).toEqual({
      text: 'Expired',
      variant: 'danger',
    });
  });

  it('does not add badge for non-expired items', () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 14);
    const items = [makeItem({ expiresAt: nextWeek.toISOString() })];

    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current[0].badge).toBeUndefined();
  });

  it('computes leftElement when image exists', () => {
    const items = [
      makeItem({ item: { imageUrl: 'https://example.com/milk.jpg' } }),
    ];

    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current[0].leftElement).toBeDefined();
  });

  it('returns undefined leftElement when no image', () => {
    const items = [makeItem()];

    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current[0].leftElement).toBeUndefined();
  });

  it('sets correct location from storage state', () => {
    const items = [
      makeItem({ storageState: 'REFRIGERATED' }),
      makeItem({ id: 'item-2', storageState: 'FROZEN' }),
      makeItem({ id: 'item-3', storageState: 'AMBIENT' }),
    ];

    const { result } = renderHook(() =>
      usePantryItemTransformation({ items, theme: mockTheme }),
    );

    expect(result.current[0].location).toBe('fridge');
    expect(result.current[1].location).toBe('freezer');
    expect(result.current[2].location).toBe('pantry');
  });

  it('handles empty items array', () => {
    const { result } = renderHook(() =>
      usePantryItemTransformation({ items: [], theme: mockTheme }),
    );

    expect(result.current).toEqual([]);
  });
});

describe('formatStorageState', () => {
  it('formats REFRIGERATED as Fridge', () => {
    expect(formatStorageState('REFRIGERATED')).toBe('Fridge');
  });
  it('formats FROZEN as Freezer', () => {
    expect(formatStorageState('FROZEN')).toBe('Freezer');
  });
  it('formats AMBIENT as Dry pantry', () => {
    expect(formatStorageState('AMBIENT')).toBe('Dry pantry');
  });
  it('returns empty string for null', () => {
    expect(formatStorageState(null)).toBe('');
  });
  it('returns original string for unknown state', () => {
    expect(formatStorageState('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('calculateExpiresIn', () => {
  it('returns null for null expiresAt', () => {
    expect(calculateExpiresIn(null)).toBeNull();
  });
  it('returns negative for past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const result = calculateExpiresIn(pastDate.toISOString());
    expect(result).toBeLessThan(0);
  });
  it('returns positive for future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const result = calculateExpiresIn(futureDate.toISOString());
    expect(result).toBeGreaterThan(0);
  });
});

describe('getLocation', () => {
  it('returns fridge for REFRIGERATED', () => {
    expect(getLocation('REFRIGERATED')).toBe('fridge');
  });
  it('returns freezer for FROZEN', () => {
    expect(getLocation('FROZEN')).toBe('freezer');
  });
  it('returns pantry for AMBIENT', () => {
    expect(getLocation('AMBIENT')).toBe('pantry');
  });
  it('returns pantry for null', () => {
    expect(getLocation(null)).toBe('pantry');
  });
});

describe('getExpirationStatus', () => {
  it('returns normal for null expiresIn', () => {
    expect(getExpirationStatus(null)).toEqual({ text: 'No expiry date', type: 'normal' });
  });
  it('returns expired for negative days', () => {
    expect(getExpirationStatus(-3)).toEqual({ text: 'Expired 3 days ago', type: 'expired' });
  });
  it('returns critical for today', () => {
    expect(getExpirationStatus(0)).toEqual({ text: 'Expires today!', type: 'critical' });
  });
  it('returns warning for tomorrow', () => {
    expect(getExpirationStatus(1)).toEqual({ text: 'Expires tomorrow!', type: 'warning' });
  });
  it('returns warning for 2-3 days', () => {
    expect(getExpirationStatus(2).type).toBe('warning');
  });
  it('returns normal for > 3 days', () => {
    expect(getExpirationStatus(10)).toEqual({ text: '10 days left', type: 'normal' });
  });
});

describe('getCategoryEmoji', () => {
  it('returns correct emoji for known categories', () => {
    expect(getCategoryEmoji('dairy')).toBe('\uD83E\uDD5B');
    expect(getCategoryEmoji('meat')).toBe('\uD83E\uDD69');
  });
  it('returns default emoji for unknown category', () => {
    expect(getCategoryEmoji('unknown')).toBe('\uD83D\uDCE6');
  });
  it('returns default emoji for null', () => {
    expect(getCategoryEmoji(null)).toBe('\uD83D\uDCE6');
  });
  it('is case-insensitive', () => {
    expect(getCategoryEmoji('DAIRY')).toBe('\uD83E\uDD5B');
  });
});

describe('formatPackageBreakdown', () => {
  it('returns null for null breakdown', () => {
    expect(formatPackageBreakdown(null)).toBeNull();
  });
  it('formats breakdown with per-unit weight', () => {
    const result = formatPackageBreakdown({
      count: 12,
      contentUnit: { name: 'cans' },
      perUnitNetWeight: 12,
      perUnitNetWeightUnit: { symbol: 'oz' },
    });
    expect(result).toBe('12 x 12 oz cans');
  });
  it('formats breakdown without per-unit weight', () => {
    const result = formatPackageBreakdown({
      count: 6,
      contentUnit: { name: 'bottles', symbol: 'btl' },
    });
    expect(result).toBe('6 btl');
  });
  it('uses remainingContentUnits when provided', () => {
    const result = formatPackageBreakdown(
      { count: 12, contentUnit: { name: 'cans' } },
      9,
    );
    expect(result).toBe('9 cans');
  });
});

describe('formatPackageBreakdownFull', () => {
  it('returns null for null breakdown', () => {
    expect(formatPackageBreakdownFull(null)).toBeNull();
  });
  it('appends total when available', () => {
    const result = formatPackageBreakdownFull({
      count: 12,
      contentUnit: { name: 'cans' },
      perUnitNetWeight: 12,
      perUnitNetWeightUnit: { symbol: 'oz' },
      totalNetWeight: 144,
    });
    expect(result).toBe('12 x 12 oz cans (144 oz total)');
  });
});

describe('formatNetWeight', () => {
  it('returns null for no weight', () => {
    expect(formatNetWeight(null)).toBeNull();
  });
  it('formats with unit symbol', () => {
    expect(formatNetWeight(14.5, { symbol: 'oz' })).toBe('14.5oz ea');
  });
});

describe('formatNetWeightDisplay', () => {
  it('returns null for no weight', () => {
    expect(formatNetWeightDisplay(null)).toBeNull();
  });
  it('upscales g to kg when >= 1000', () => {
    expect(formatNetWeightDisplay(1500, { symbol: 'g' })).toBe('1.5 kg');
  });
  it('upscales ml to L when >= 1000', () => {
    expect(formatNetWeightDisplay(2000, { symbol: 'ml' })).toBe('2.0 L');
  });
  it('formats integer values', () => {
    expect(formatNetWeightDisplay(500, { symbol: 'g' })).toBe('500 g');
  });
});

describe('formatRemainingNetWeight', () => {
  it('returns null for null remaining', () => {
    expect(formatRemainingNetWeight(null)).toBeNull();
  });
  it('formats remaining weight', () => {
    expect(formatRemainingNetWeight(25, { symbol: 'oz' })).toBe('25 oz remaining');
  });
});

describe('formatQuantityBreakdown', () => {
  it('returns null for null breakdown', () => {
    expect(formatQuantityBreakdown(null)).toBeNull();
  });
  it('returns null when total is 0', () => {
    const result = formatQuantityBreakdown({
      fullPackages: 0,
      looseContentUnits: 0,
      totalContentUnits: 0,
    });
    expect(result).toBeNull();
  });
  it('formats total content units', () => {
    const result = formatQuantityBreakdown({
      fullPackages: 1,
      looseContentUnits: 3,
      contentUnit: { name: 'can', symbol: 'can' },
      totalContentUnits: 15,
    });
    expect(result).toBe('15 cans');
  });
  it('handles singular unit', () => {
    const result = formatQuantityBreakdown({
      fullPackages: 0,
      looseContentUnits: 1,
      contentUnit: { name: 'bottle' },
      totalContentUnits: 1,
    });
    expect(result).toBe('1 bottle');
  });
});

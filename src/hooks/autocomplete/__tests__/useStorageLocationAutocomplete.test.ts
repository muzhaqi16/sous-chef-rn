import { renderHook } from '@testing-library/react-native';
import { useStorageLocationAutocomplete } from '../useStorageLocationAutocomplete';
import { StorageLocation, StorageType } from '#/graphql/generated/schemaTypes';

const makeLocation = (
  overrides: Partial<StorageLocation> = {},
): StorageLocation =>
  ({
    id: 'loc-1',
    name: 'Fridge',
    type: StorageType.Refrigerator,
    isDefault: false,
    ...overrides,
  } as StorageLocation);

const storageLocations: StorageLocation[] = [
  makeLocation({
    id: '1',
    name: 'Fridge',
    type: StorageType.Refrigerator,
    isDefault: true,
  }),
  makeLocation({
    id: '2',
    name: 'Pantry Shelf',
    type: StorageType.PantryShelf,
    isDefault: false,
  }),
  makeLocation({
    id: '3',
    name: 'Freezer',
    type: StorageType.Freezer,
    isDefault: false,
    parentLocation: makeLocation({ id: '1', name: 'Fridge' }),
  }),
  makeLocation({
    id: '4',
    name: 'Counter',
    type: StorageType.Counter,
    isDefault: false,
  }),
  makeLocation({
    id: '5',
    name: 'Cabinet',
    type: StorageType.Cabinet,
    isDefault: false,
  }),
];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useStorageLocationAutocomplete', () => {
  it('returns all locations sorted with defaults first when searchTerm is empty', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations, searchTerm: '' }),
    );

    expect(result.current.displayItems).toHaveLength(5);
    // Default (Fridge) should be first
    expect(result.current.displayItems[0].name).toBe('Fridge');
    expect(result.current.displayItems[0].isDefault).toBe(true);
  });

  it('filters locations by name match', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({
        storageLocations,
        searchTerm: 'fridge',
      }),
    );

    const names = result.current.displayItems.map(l => l.name);
    expect(names).toContain('Fridge');
  });

  it('filters locations by type match', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({
        storageLocations,
        searchTerm: 'refrigerator',
      }),
    );

    const names = result.current.displayItems.map(l => l.name);
    expect(names).toContain('Fridge');
    expect(names).not.toContain('Counter');
  });

  it('filters locations by parent location name match', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({
        storageLocations,
        searchTerm: 'fridge',
      }),
    );

    // Freezer has parentLocation named 'Fridge'
    const names = result.current.displayItems.map(l => l.name);
    expect(names).toContain('Freezer');
  });

  it('returns empty results when no locations match search term', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations, searchTerm: 'zzz' }),
    );

    expect(result.current.displayItems).toHaveLength(0);
  });

  it('sorts results with default locations first, then alphabetically', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations, searchTerm: '' }),
    );

    const items = result.current.displayItems;
    // Fridge is default, should be first
    expect(items[0].isDefault).toBe(true);
    // Rest should be alphabetically sorted
    const nonDefault = items.slice(1);
    for (let i = 0; i < nonDefault.length - 1; i++) {
      expect(
        nonDefault[i].name.localeCompare(nonDefault[i + 1].name),
      ).toBeLessThanOrEqual(0);
    }
  });

  it('showAddNew is true when searchTerm is >= 2 chars and no exact match exists', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({
        storageLocations,
        searchTerm: 'Garage',
      }),
    );

    expect(result.current.showAddNew).toBe(true);
  });

  it('showAddNew is false when searchTerm has an exact match (case-insensitive)', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({
        storageLocations,
        searchTerm: 'Fridge',
      }),
    );

    expect(result.current.showAddNew).toBe(false);
  });

  it('showAddNew is false when searchTerm is less than 2 characters', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations, searchTerm: 'F' }),
    );

    expect(result.current.showAddNew).toBe(false);
  });

  it('isLoading is always false (fully local)', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations, searchTerm: 'test' }),
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('isOnline is always true (fully local)', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations, searchTerm: '' }),
    );

    expect(result.current.isOnline).toBe(true);
  });

  it('handles empty storageLocations array', () => {
    const { result } = renderHook(() =>
      useStorageLocationAutocomplete({ storageLocations: [], searchTerm: '' }),
    );

    expect(result.current.displayItems).toEqual([]);
    expect(result.current.showAddNew).toBe(false);
  });
});

import { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetHomesDocument } from '#operations/home/home.generated';
import {
  homesData,
  type HomeFixture,
} from '../../../../../__tests__/helpers/fixtures/homeFixtures';
import { useCurrentPantry } from '../useCurrentPantry';

const mockStoreState = {
  selectedHomeId: null as string | null,
  setSelectedHomeId: jest.fn(),
  selectedPantryId: null as string | null,
  setSelectedPantryId: jest.fn(),
  isHomeSelectionReady: false,
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: typeof mockStoreState) => T): T =>
    selector(mockStoreState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  usePantryState: jest.fn(() => ({
    selectedPantryId: mockStoreState.selectedPantryId,
    setSelectedPantryId: mockStoreState.setSelectedPantryId,
  })),
  useIsHomeSelectionReady: jest.fn(() => mockStoreState.isHomeSelectionReady),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  mockStoreState.isHomeSelectionReady = false;
});

/**
 * Build a cache pre-populated with GetHomes data in the actual production
 * Connection-shape selection (HomeListFragment). Production code's
 * `normalizeHome` then converts the connections into flat arrays.
 */
function cacheWithHomes(homes: HomeFixture[]): InMemoryCache {
  const cache = makeCache();
  cache.writeQuery({
    query: GetHomesDocument,
    data: homesData(homes),
  });
  return cache;
}

function emptyCache(): InMemoryCache {
  return makeCache();
}

describe('useCurrentPantry', () => {
  it('returns not-ready state when isHomeSelectionReady is false', () => {
    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: emptyCache(),
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.pantry).toBeNull();
    expect(result.current.pantries).toEqual([]);
    expect(result.current.selectedPantryId).toBeNull();
    expect(result.current.currentHome).toBeNull();
    expect(result.current.selectedHomeId).toBeNull();
  });

  it('returns pantry from selected pantry ID', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-2';

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([
        {
          id: 'home-1',
          pantries: [
            { id: 'pantry-1', name: 'Main Pantry', isDefault: true },
            { id: 'pantry-2', name: 'Garage Pantry', isDefault: false },
          ],
        },
      ]),
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    await waitFor(() =>
      expect(result.current.pantry).toEqual(
        expect.objectContaining({ id: 'pantry-2', name: 'Garage Pantry' }),
      ),
    );
  });

  it('falls back to default pantry when selectedPantryId not found', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'nonexistent';

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([
        {
          id: 'home-1',
          pantries: [{ id: 'pantry-1', name: 'Default', isDefault: true }],
        },
      ]),
    });

    await waitFor(() =>
      expect(result.current.pantry).toEqual(
        expect.objectContaining({ id: 'pantry-1', name: 'Default' }),
      ),
    );
  });

  it('falls back to first pantry when no default marked', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = null;

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([
        {
          id: 'home-1',
          pantries: [
            { id: 'pantry-1', name: 'First', isDefault: false },
            { id: 'pantry-2', name: 'Second', isDefault: false },
          ],
        },
      ]),
    });

    await waitFor(() =>
      expect(result.current.pantry).toEqual(
        expect.objectContaining({ id: 'pantry-1' }),
      ),
    );
  });

  it('returns minimal object when only selectedPantryId exists but no home data', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-1';

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: emptyCache(),
    });

    expect(result.current.pantry).toEqual({
      id: 'pantry-1',
      name: 'Pantry',
      isDefault: false,
    });
  });

  it('returns null pantry when ready but no pantries exist', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = null;

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([{ id: 'home-1', pantries: [] }]),
    });

    await waitFor(() => expect(result.current.pantry).toBeNull());
  });

  it('returns null when selectedPantryId points to a deleted pantry', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'deleted-pantry';

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([{ id: 'home-1', pantries: [] }]),
    });

    await waitFor(() => expect(result.current.pantry).toBeNull());
  });

  it('clears stale selectedPantryId pointing to a missing pantry', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'deleted-pantry';

    renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([{ id: 'home-1', pantries: [] }]),
    });

    await waitFor(() =>
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(null),
    );
  });

  it('returns all pantries from current home', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([
        {
          id: 'home-1',
          pantries: [
            { id: 'p-1', name: 'Pantry 1', isDefault: true },
            { id: 'p-2', name: 'Pantry 2', isDefault: false },
          ],
        },
      ]),
    });

    await waitFor(() => expect(result.current.pantries).toHaveLength(2));
  });

  it('returns currentHome when ready', async () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: cacheWithHomes([
        { id: 'home-1', name: 'Test Home', pantries: [] },
      ]),
    });

    await waitFor(() =>
      expect(result.current.currentHome).toEqual(
        expect.objectContaining({ id: 'home-1', name: 'Test Home' }),
      ),
    );
  });

  it('exposes setSelectedPantryId', () => {
    const { result } = renderHookWithApollo(() => useCurrentPantry(), {
      cache: emptyCache(),
    });

    expect(result.current.setSelectedPantryId).toBe(
      mockStoreState.setSelectedPantryId,
    );
  });
});

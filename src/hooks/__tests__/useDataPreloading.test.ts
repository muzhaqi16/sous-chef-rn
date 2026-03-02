import { renderHook } from '@testing-library/react-native';
import { useDataPreloading } from '../useDataPreloading';

const mockFetchCommonUnits = jest.fn();
const mockSetCachedUnits = jest.fn();
const mockSetLastUnitsFetchedAt = jest.fn();

let mockStoreState: Record<string, any> = {};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  selectAuthState: (s: any) => ({ user: s.user, accessToken: s.accessToken }),
  selectIsPantryQueryComplete: (s: any) => s.isPantryQueryComplete,
}));

jest.mock('zustand/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('#generated', () => ({
  useGetCommonUnitsLazyQuery: jest.fn(() => [
    mockFetchCommonUnits,
    { data: null },
  ]),
}));

// Break circular dependency
jest.mock('../../apollo/links/tokenScheduler', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState = {
    user: { id: 'user-1' },
    accessToken: 'token-123',
    cachedUnits: [],
    setCachedUnits: mockSetCachedUnits,
    lastUnitsFetchedAt: null,
    setLastUnitsFetchedAt: mockSetLastUnitsFetchedAt,
    isOnline: true,
    isPantryQueryComplete: false,
  };
});

describe('useDataPreloading', () => {
  it('returns initial preloading state', () => {
    const { result } = renderHook(() => useDataPreloading());

    expect(result.current.isPreloading).toBe(false);
    expect(result.current.preloadError).toBeUndefined();
    expect(result.current.unitsLoaded).toBe(false);
  });

  it('unitsLoaded is true when cachedUnits has items', () => {
    mockStoreState.cachedUnits = [{ id: 'u1', name: 'gram', symbol: 'g' }];

    const { result } = renderHook(() => useDataPreloading());

    expect(result.current.unitsLoaded).toBe(true);
  });

  it('does not fetch when not authenticated', () => {
    mockStoreState.user = null;
    mockStoreState.accessToken = null;
    mockStoreState.isPantryQueryComplete = true;

    renderHook(() => useDataPreloading());

    expect(mockFetchCommonUnits).not.toHaveBeenCalled();
  });

  it('does not fetch when offline', () => {
    mockStoreState.isOnline = false;
    mockStoreState.isPantryQueryComplete = true;

    renderHook(() => useDataPreloading());

    expect(mockFetchCommonUnits).not.toHaveBeenCalled();
  });

  it('does not fetch when pantry query is not yet complete', () => {
    mockStoreState.isPantryQueryComplete = false;

    renderHook(() => useDataPreloading());

    expect(mockFetchCommonUnits).not.toHaveBeenCalled();
  });

  it('fetches units when all conditions are met', async () => {
    mockStoreState.isPantryQueryComplete = true;
    mockFetchCommonUnits.mockResolvedValueOnce({});

    renderHook(() => useDataPreloading());

    // Should have been called because auth + online + pantry complete + no cache
    expect(mockFetchCommonUnits).toHaveBeenCalledTimes(1);
  });

  it('skips fetch when cache is fresh', () => {
    mockStoreState.isPantryQueryComplete = true;
    mockStoreState.cachedUnits = [{ id: 'u1' }];
    mockStoreState.lastUnitsFetchedAt = Date.now(); // Fresh (within 24h)

    renderHook(() => useDataPreloading());

    expect(mockFetchCommonUnits).not.toHaveBeenCalled();
  });

  it('fetches when cache is stale', async () => {
    mockStoreState.isPantryQueryComplete = true;
    mockStoreState.cachedUnits = [{ id: 'u1' }];
    // Set to 25 hours ago (stale)
    mockStoreState.lastUnitsFetchedAt = Date.now() - 25 * 60 * 60 * 1000;
    mockFetchCommonUnits.mockResolvedValueOnce({});

    renderHook(() => useDataPreloading());

    expect(mockFetchCommonUnits).toHaveBeenCalledTimes(1);
  });

  it('resets flags on logout', () => {
    mockStoreState.user = null;
    mockStoreState.accessToken = null;

    renderHook(() => useDataPreloading());

    // setLastUnitsFetchedAt(0) is called during the logout reset effect
    expect(mockSetLastUnitsFetchedAt).toHaveBeenCalledWith(0);
  });
});

import { renderHook } from '@testing-library/react-native';
import { useDefaultHome } from '../useDefaultHome';

// Apollo client mock
const mockApolloClient = {
  cache: {
    identify: jest.fn((obj: any) => `${obj.__typename}:${obj.id}`),
    evict: jest.fn(),
    gc: jest.fn(),
  },
};

jest.mock('@apollo/client/react', () => ({
  useApolloClient: jest.fn(() => mockApolloClient),
}));

const mockSetDefaultHomeMutation = jest.fn().mockResolvedValue({
  data: { setDefaultHome: { success: true, defaultPantry: null } },
});
const mockGetHomes = jest.fn();

const mockHomesQueryResult = {
  data: undefined as any,
  loading: false,
  error: undefined,
  called: false,
};

jest.mock('#generated', () => ({
  useSetDefaultHomeMutation: jest.fn(() => [mockSetDefaultHomeMutation]),
  useGetHomesLazyQuery: jest.fn(() => [mockGetHomes, mockHomesQueryResult]),
}));

// Store mock state
const mockStoreState = {
  selectedHomeId: null as string | null,
  setSelectedHomeId: jest.fn(),
  selectedPantryId: null as string | null,
  setSelectedPantryId: jest.fn(),
  isHomeSelectionReady: false,
  setIsHomeSelectionReady: jest.fn(),
  isLoggingOut: false,
  hasInitializedHomeData: false,
  setHasInitializedHomeData: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  selectPantryState: (state: any) => ({
    selectedPantryId: state.selectedPantryId,
    setSelectedPantryId: state.setSelectedPantryId,
    selectedHomeId: state.selectedHomeId,
    setSelectedHomeId: state.setSelectedHomeId,
  }),
  selectSelectedHomeId: (state: any) => state.selectedHomeId,
  selectIsHomeSelectionReady: (state: any) => state.isHomeSelectionReady,
  selectSetIsHomeSelectionReady: (state: any) => state.setIsHomeSelectionReady,
  selectIsLoggingOut: (state: any) => state.isLoggingOut,
}));

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      hasInitializedHomeData: mockStoreState.hasInitializedHomeData,
      setHasInitializedHomeData: mockStoreState.setHasInitializedHomeData,
    })),
  },
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({ canAttemptQueries: true }),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn((data: any) => data ?? []),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHomes: jest.fn((homes: any) => homes ?? []),
  normalizeHome: jest.fn((home: any) => home),
  extractNodes: jest.fn((connection: any) => {
    if (!connection?.edges) return [];
    return connection.edges.map((e: any) => e?.node).filter(Boolean);
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  mockStoreState.isHomeSelectionReady = false;
  mockStoreState.isLoggingOut = false;
  mockStoreState.hasInitializedHomeData = false;
  mockHomesQueryResult.data = undefined;
  mockHomesQueryResult.loading = false;
  mockHomesQueryResult.called = false;
  mockSetDefaultHomeMutation.mockResolvedValue({
    data: { setDefaultHome: { success: true, defaultPantry: null } },
  });
});

describe('useDefaultHome', () => {
  it('returns initial state when no data', () => {
    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.selectedHomeId).toBeNull();
    expect(result.current.homes).toEqual([]);
    expect(result.current.hasDefaultHome).toBe(false);
    expect(result.current.remoteDefaultHomeId).toBeNull();
    expect(result.current.isHomeSelectionReady).toBe(false);
  });

  it('returns selectedHomeId from store', () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.selectedHomeId).toBe('home-1');
    expect(result.current.hasDefaultHome).toBe(true);
  });

  it('falls back to remoteDefaultHomeId when no selectedHomeId', () => {
    mockHomesQueryResult.data = {
      homes: {
        edges: [
          {
            node: {
              id: 'home-1',
              isDefault: true,
              pantries: [],
            },
          },
        ],
      },
    };

    const { result } = renderHook(() => useDefaultHome());

    // selectedHomeId is null, remoteDefaultHomeId is 'home-1'
    expect(result.current.selectedHomeId).toBe('home-1');
    expect(result.current.remoteDefaultHomeId).toBe('home-1');
  });

  it('returns homes from query data', () => {
    mockHomesQueryResult.data = {
      homes: {
        edges: [
          { node: { id: 'home-1', isDefault: true, pantries: [] } },
          { node: { id: 'home-2', isDefault: false, pantries: [] } },
        ],
      },
    };

    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.homes).toHaveLength(2);
  });

  it('exposes loading state', () => {
    mockHomesQueryResult.loading = true;

    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.loading).toBe(true);
  });

  it('exposes error', () => {
    mockHomesQueryResult.error = new Error('Query failed') as any;

    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.error).toBeDefined();
  });

  describe('getDefaultPantry', () => {
    it('returns default pantry from home', () => {
      const { result } = renderHook(() => useDefaultHome());

      const home = {
        pantries: [
          { id: 'p-1', isDefault: false },
          { id: 'p-2', isDefault: true },
        ],
      };

      const pantry = result.current.getDefaultPantry(home);
      expect(pantry?.id).toBe('p-2');
    });

    it('returns first pantry when no default marked', () => {
      const { result } = renderHook(() => useDefaultHome());

      const home = {
        pantries: [
          { id: 'p-1', isDefault: false },
          { id: 'p-2', isDefault: false },
        ],
      };

      const pantry = result.current.getDefaultPantry(home);
      expect(pantry?.id).toBe('p-1');
    });

    it('returns null when no pantries', () => {
      const { result } = renderHook(() => useDefaultHome());

      const pantry = result.current.getDefaultPantry({ pantries: [] });
      expect(pantry).toBeNull();
    });

    it('handles nested home property', () => {
      const { result } = renderHook(() => useDefaultHome());

      const homeData = {
        home: {
          pantries: [{ id: 'p-1', isDefault: true }],
        },
      };

      const pantry = result.current.getDefaultPantry(homeData);
      expect(pantry?.id).toBe('p-1');
    });

    it('returns null for null input', () => {
      const { result } = renderHook(() => useDefaultHome());

      const pantry = result.current.getDefaultPantry(null);
      expect(pantry).toBeNull();
    });
  });

  it('exposes selectedPantryId and setSelectedPantryId', () => {
    mockStoreState.selectedPantryId = 'pantry-1';

    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.selectedPantryId).toBe('pantry-1');
    expect(typeof result.current.setSelectedPantryId).toBe('function');
  });

  it('sets early ready when persisted home/pantry IDs exist', () => {
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-1';
    mockStoreState.isHomeSelectionReady = false;

    renderHook(() => useDefaultHome());

    expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(true);
  });

  it('does not set early ready when already ready', () => {
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-1';
    mockStoreState.isHomeSelectionReady = true;

    renderHook(() => useDefaultHome());

    // Should not call setIsHomeSelectionReady since already ready
    expect(mockStoreState.setIsHomeSelectionReady).not.toHaveBeenCalled();
  });

  it('does not set early ready when no selectedPantryId', () => {
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = null;
    mockStoreState.isHomeSelectionReady = false;

    renderHook(() => useDefaultHome());

    // Should not set ready without pantry
    expect(mockStoreState.setIsHomeSelectionReady).not.toHaveBeenCalledWith(true);
  });

  describe('getDefaultPantry - additional', () => {
    it('returns null when home has no pantries property', () => {
      const { result } = renderHook(() => useDefaultHome());

      const pantry = result.current.getDefaultPantry({});
      expect(pantry).toBeNull();
    });

    it('returns null for undefined input', () => {
      const { result } = renderHook(() => useDefaultHome());

      const pantry = result.current.getDefaultPantry(undefined);
      expect(pantry).toBeNull();
    });
  });

  describe('home selection ready state', () => {
    it('sets ready when no homes exist and query was called', () => {
      mockHomesQueryResult.called = true;
      mockHomesQueryResult.loading = false;
      mockHomesQueryResult.data = { homes: { edges: [] } };

      renderHook(() => useDefaultHome());

      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(true);
    });

    it('sets ready when valid home is selected', () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockHomesQueryResult.called = true;
      mockHomesQueryResult.loading = false;
      mockHomesQueryResult.data = {
        homes: {
          edges: [
            { node: { id: 'home-1', isDefault: true, pantries: [] } },
          ],
        },
      };

      renderHook(() => useDefaultHome());

      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(true);
    });

    it('does not set ready while loading', () => {
      mockHomesQueryResult.called = true;
      mockHomesQueryResult.loading = true;

      renderHook(() => useDefaultHome());

      // Should not call setIsHomeSelectionReady when loading
    });
  });

  describe('default pantry extraction', () => {
    it('extracts default pantry from homes data', () => {
      mockHomesQueryResult.data = {
        homes: {
          edges: [
            {
              node: {
                id: 'home-1',
                isDefault: true,
                pantries: [
                  { id: 'pantry-1', isDefault: false },
                  { id: 'pantry-2', isDefault: true },
                ],
              },
            },
          ],
        },
      };

      const { result } = renderHook(() => useDefaultHome());

      // remoteDefaultHomeId should be home-1
      expect(result.current.remoteDefaultHomeId).toBe('home-1');
    });

    it('falls back to first pantry when no default marked', () => {
      mockHomesQueryResult.data = {
        homes: {
          edges: [
            {
              node: {
                id: 'home-1',
                isDefault: true,
                pantries: [
                  { id: 'pantry-1', isDefault: false },
                ],
              },
            },
          ],
        },
      };

      const { result } = renderHook(() => useDefaultHome());
      expect(result.current.remoteDefaultHomeId).toBe('home-1');
    });
  });

  it('returns hasDefaultHome as true when currentHomeId exists', () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHook(() => useDefaultHome());

    expect(result.current.hasDefaultHome).toBe(true);
  });

  it('returns hasDefaultHome as false when no home is selected or default', () => {
    const { result } = renderHook(() => useDefaultHome());
    expect(result.current.hasDefaultHome).toBe(false);
  });
});

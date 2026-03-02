import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useHomeSelection } from '../useHomeSelection';

const mockSetDefaultHomeMutation = jest.fn();

jest.mock('#generated', () => ({
  useSetDefaultHomeMutation: jest.fn(() => [mockSetDefaultHomeMutation]),
}));

// Store mock state
const mockStoreState = {
  selectedHomeId: null as string | null,
  selectedPantryId: null as string | null,
  setSelectedHomeId: jest.fn(),
  setSelectedPantryId: jest.fn(),
  setHomeAndPantry: jest.fn(),
  setIsHomeSelectionReady: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  selectSelectedHomeId: (state: any) => state.selectedHomeId,
  selectHomeState: (state: any) => ({
    selectedHomeId: state.selectedHomeId,
    setSelectedHomeId: state.setSelectedHomeId,
  }),
  selectSetHomeAndPantry: (state: any) => state.setHomeAndPantry,
  selectSetIsHomeSelectionReady: (state: any) => state.setIsHomeSelectionReady,
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Error message' })),
  }),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutationWithErrorHandler: jest.fn(
    async (fn: () => Promise<any>, onError: (err: unknown) => void) => {
      try {
        return await fn();
      } catch (error) {
        onError(error);
        return false;
      }
    },
  ),
}));

jest.spyOn(Alert, 'alert');

const createHomes = () => [
  {
    id: 'home-1',
    name: 'Home 1',
    pantries: [
      { id: 'pantry-1', isDefault: true },
      { id: 'pantry-2', isDefault: false },
    ],
  },
  {
    id: 'home-2',
    name: 'Home 2',
    pantries: [{ id: 'pantry-3', isDefault: true }],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  // Ensure mutation always returns a promise (useEffect calls it with .catch)
  mockSetDefaultHomeMutation.mockResolvedValue({
    data: { setDefaultHome: { success: true, defaultPantry: null } },
  });
});

describe('useHomeSelection', () => {
  it('returns selection state', () => {
    const { result } = renderHook(() =>
      useHomeSelection({
        homes: createHomes(),
        remoteDefaultHomeId: 'home-1',
        loading: false,
      }),
    );

    expect(result.current.selectedHomeId).toBeNull();
    expect(result.current.defaultHome).toBeNull();
    expect(result.current.isSynced).toBe(false);
  });

  it('computes defaultHome from selectedHomeId', () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHook(() =>
      useHomeSelection({
        homes: createHomes(),
        remoteDefaultHomeId: 'home-1',
        loading: false,
      }),
    );

    expect(result.current.defaultHome).toEqual(
      expect.objectContaining({ id: 'home-1', name: 'Home 1' }),
    );
  });

  it('reports isSynced when selectedHomeId matches remoteDefaultHomeId', () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHook(() =>
      useHomeSelection({
        homes: createHomes(),
        remoteDefaultHomeId: 'home-1',
        loading: false,
      }),
    );

    expect(result.current.isSynced).toBe(true);
  });

  it('reports not synced when IDs differ', () => {
    mockStoreState.selectedHomeId = 'home-2';

    const { result } = renderHook(() =>
      useHomeSelection({
        homes: createHomes(),
        remoteDefaultHomeId: 'home-1',
        loading: false,
      }),
    );

    expect(result.current.isSynced).toBe(false);
  });

  describe('setDefaultHome', () => {
    it('returns true early when home is already default both locally and remotely', async () => {
      mockStoreState.selectedHomeId = 'home-1';

      const { result } = renderHook(() =>
        useHomeSelection({
          homes: createHomes(),
          remoteDefaultHomeId: 'home-1',
          loading: false,
        }),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-1');
      });

      expect(success!).toBe(true);
      expect(mockSetDefaultHomeMutation).not.toHaveBeenCalled();
    });

    it('shows error for empty homeId', async () => {
      const { result } = renderHook(() =>
        useHomeSelection({
          homes: createHomes(),
          remoteDefaultHomeId: null,
          loading: false,
        }),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('');
      });

      expect(success!).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid home ID');
    });

    it('shows error when home not found in list', async () => {
      const { result } = renderHook(() =>
        useHomeSelection({
          homes: createHomes(),
          remoteDefaultHomeId: null,
          loading: false,
        }),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('nonexistent-home');
      });

      expect(success!).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Home not found');
    });

    it('calls mutation and updates state on success', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

      mockSetDefaultHomeMutation.mockResolvedValue({
        data: {
          setDefaultHome: {
            success: true,
            defaultPantry: { id: 'pantry-3' },
          },
        },
      });

      const { result } = renderHook(() =>
        useHomeSelection({
          homes: createHomes(),
          remoteDefaultHomeId: 'home-1',
          loading: false,
        }),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(true);
      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(false);
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith('home-2', 'pantry-3');
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith('pantry-3');
    });

    it('rolls back on mutation failure', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

      mockSetDefaultHomeMutation.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useHomeSelection({
          homes: createHomes(),
          remoteDefaultHomeId: null,
          loading: false,
        }),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(false);
      // Rollback: setHomeAndPantry called with previous values
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith('home-1', 'pantry-1');
    });

    it('rolls back when mutation returns no data', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

      mockSetDefaultHomeMutation.mockResolvedValue({
        data: { setDefaultHome: { success: false } },
      });

      const { result } = renderHook(() =>
        useHomeSelection({
          homes: createHomes(),
          remoteDefaultHomeId: null,
          loading: false,
        }),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(false);
    });
  });

  it('exposes setSelectedHomeId and setSelectedPantryId', () => {
    const { result } = renderHook(() =>
      useHomeSelection({
        homes: [],
        remoteDefaultHomeId: null,
        loading: false,
      }),
    );

    expect(result.current.setSelectedHomeId).toBe(mockStoreState.setSelectedHomeId);
    expect(result.current.setSelectedPantryId).toBe(mockStoreState.setSelectedPantryId);
  });
});

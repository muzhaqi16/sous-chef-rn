import { renderHook } from '@testing-library/react-native';
import { useCurrentPantry } from '../useCurrentPantry';

const mockHomesQueryResult = {
  data: undefined as any,
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetHomesQuery: jest.fn(() => mockHomesQueryResult),
}));

const mockStoreState = {
  selectedHomeId: null as string | null,
  setSelectedHomeId: jest.fn(),
  selectedPantryId: null as string | null,
  setSelectedPantryId: jest.fn(),
  isHomeSelectionReady: false,
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  selectSelectedHomeId: (state: any) => state.selectedHomeId,
  selectPantryState: (state: any) => ({
    selectedPantryId: state.selectedPantryId,
    setSelectedPantryId: state.setSelectedPantryId,
  }),
  selectIsHomeSelectionReady: (state: any) => state.isHomeSelectionReady,
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

function createHomesData(homes: any[]) {
  return {
    homes: {
      edges: homes.map(h => ({ node: h })),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  mockStoreState.isHomeSelectionReady = false;
  mockHomesQueryResult.data = undefined;
});

describe('useCurrentPantry', () => {
  it('returns not-ready state when isHomeSelectionReady is false', () => {
    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.isReady).toBe(false);
    expect(result.current.pantry).toBeNull();
    expect(result.current.pantries).toEqual([]);
    expect(result.current.selectedPantryId).toBeNull();
    expect(result.current.currentHome).toBeNull();
    expect(result.current.selectedHomeId).toBeNull();
  });

  it('returns pantry from selected pantry ID', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-2';

    mockHomesQueryResult.data = createHomesData([
      {
        id: 'home-1',
        pantries: [
          { id: 'pantry-1', name: 'Main Pantry', isDefault: true },
          { id: 'pantry-2', name: 'Garage Pantry', isDefault: false },
        ],
      },
    ]);

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.isReady).toBe(true);
    expect(result.current.pantry).toEqual(
      expect.objectContaining({ id: 'pantry-2', name: 'Garage Pantry' }),
    );
  });

  it('falls back to default pantry when selectedPantryId not found', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'nonexistent';

    mockHomesQueryResult.data = createHomesData([
      {
        id: 'home-1',
        pantries: [
          { id: 'pantry-1', name: 'Default', isDefault: true },
        ],
      },
    ]);

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.pantry).toEqual(
      expect.objectContaining({ id: 'pantry-1', name: 'Default' }),
    );
  });

  it('falls back to first pantry when no default marked', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = null;

    mockHomesQueryResult.data = createHomesData([
      {
        id: 'home-1',
        pantries: [
          { id: 'pantry-1', name: 'First', isDefault: false },
          { id: 'pantry-2', name: 'Second', isDefault: false },
        ],
      },
    ]);

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.pantry).toEqual(
      expect.objectContaining({ id: 'pantry-1' }),
    );
  });

  it('returns minimal object when only selectedPantryId exists but no home data', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-1';

    // No homes data
    mockHomesQueryResult.data = undefined;

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.pantry).toEqual({
      id: 'pantry-1',
      name: 'Pantry',
      isDefault: false,
    });
  });

  it('returns null pantry when ready but no pantries exist', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = null;

    mockHomesQueryResult.data = createHomesData([
      { id: 'home-1', pantries: [] },
    ]);

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.pantry).toBeNull();
  });

  it('returns all pantries from current home', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';

    mockHomesQueryResult.data = createHomesData([
      {
        id: 'home-1',
        pantries: [
          { id: 'p-1', name: 'Pantry 1', isDefault: true },
          { id: 'p-2', name: 'Pantry 2', isDefault: false },
        ],
      },
    ]);

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.pantries).toHaveLength(2);
  });

  it('returns currentHome when ready', () => {
    mockStoreState.isHomeSelectionReady = true;
    mockStoreState.selectedHomeId = 'home-1';

    mockHomesQueryResult.data = createHomesData([
      {
        id: 'home-1',
        name: 'Test Home',
        pantries: [],
      },
    ]);

    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.currentHome).toEqual(
      expect.objectContaining({ id: 'home-1', name: 'Test Home' }),
    );
  });

  it('exposes setSelectedPantryId', () => {
    const { result } = renderHook(() => useCurrentPantry());

    expect(result.current.setSelectedPantryId).toBe(mockStoreState.setSelectedPantryId);
  });
});

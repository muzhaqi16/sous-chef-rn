import { renderHook } from '@testing-library/react-native';
import { useHomeManagement } from '../useHomeManagement';

// Mock all sub-hooks
const mockHomeQuery = {
  homes: [{ id: 'home-1', name: 'Home 1' }],
  remoteDefaultHomeId: 'home-1',
  loading: false,
  initialLoading: false,
  error: undefined,
  stats: { totalHomes: 1, totalMembers: 2, totalPantries: 1 },
  refetch: jest.fn(),
};

const mockHomeSelection = {
  selectedHomeId: 'home-1',
  defaultHome: { id: 'home-1', name: 'Home 1' },
  isSynced: true,
  setDefaultHome: jest.fn(),
  setSelectedHomeId: jest.fn(),
  setSelectedPantryId: jest.fn(),
};

const mockHomeMutations = {
  createHome: jest.fn(),
  updateHome: jest.fn(),
  deleteHome: jest.fn(),
  creating: false,
  updating: false,
  deleting: false,
};

const mockHomeInvitations = {
  inviteUserToHome: jest.fn(),
  joinHomeByCode: jest.fn(),
  previewHomeByCode: jest.fn(),
  previewHome: null,
  inviting: false,
  joiningByCode: false,
  loadingPreview: false,
};

jest.mock('../useHomeQuery', () => ({
  useHomeQuery: jest.fn(() => mockHomeQuery),
}));

jest.mock('../useHomeSelection', () => ({
  useHomeSelection: jest.fn(() => mockHomeSelection),
}));

jest.mock('../useHomeMutations', () => ({
  useHomeMutations: jest.fn(() => mockHomeMutations),
}));

jest.mock('../useHomeInvitations', () => ({
  useHomeInvitations: jest.fn(() => mockHomeInvitations),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useHomeManagement', () => {
  it('composes all sub-hooks and returns combined interface', () => {
    const { result } = renderHook(() => useHomeManagement());

    // Data from useHomeQuery
    expect(result.current.homes).toEqual([{ id: 'home-1', name: 'Home 1' }]);
    expect(result.current.allHomes).toEqual([{ id: 'home-1', name: 'Home 1' }]);
    expect(result.current.remoteDefaultHomeId).toBe('home-1');
    expect(result.current.loading).toBe(false);
    expect(result.current.initialLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.stats).toEqual({
      totalHomes: 1,
      totalMembers: 2,
      totalPantries: 1,
    });

    // Data from useHomeSelection
    expect(result.current.defaultHomeId).toBe('home-1');
    expect(result.current.defaultHome).toEqual({
      id: 'home-1',
      name: 'Home 1',
    });
    expect(result.current.isSynced).toBe(true);

    // Functions from useHomeMutations
    expect(result.current.createHome).toBe(mockHomeMutations.createHome);
    expect(result.current.updateHome).toBe(mockHomeMutations.updateHome);
    expect(result.current.deleteHome).toBe(mockHomeMutations.deleteHome);

    // Loading states
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
    expect(result.current.inviting).toBe(false);
    expect(result.current.joiningByCode).toBe(false);
    expect(result.current.loadingPreview).toBe(false);

    // Functions from useHomeInvitations
    expect(result.current.inviteUserToHome).toBe(
      mockHomeInvitations.inviteUserToHome,
    );
    expect(result.current.joinHomeByCode).toBe(
      mockHomeInvitations.joinHomeByCode,
    );
    expect(result.current.previewHomeByCode).toBe(
      mockHomeInvitations.previewHomeByCode,
    );
    expect(result.current.previewHome).toBeNull();

    // Other
    expect(result.current.setDefaultHome).toBe(
      mockHomeSelection.setDefaultHome,
    );
    expect(result.current.refetch).toBe(mockHomeQuery.refetch);
  });

  it('passes homes data to useHomeSelection', () => {
    renderHook(() => useHomeManagement());

    const { useHomeSelection } = jest.requireMock('../useHomeSelection');
    expect(useHomeSelection).toHaveBeenCalledWith({
      homes: mockHomeQuery.homes,
      remoteDefaultHomeId: mockHomeQuery.remoteDefaultHomeId,
      loading: mockHomeQuery.loading,
    });
  });

  it('passes options to useHomeMutations', () => {
    renderHook(() => useHomeManagement());

    const { useHomeMutations } = jest.requireMock('../useHomeMutations');
    expect(useHomeMutations).toHaveBeenCalledWith({
      refetch: mockHomeQuery.refetch,
      setDefaultHome: mockHomeSelection.setDefaultHome,
      setSelectedPantryId: mockHomeSelection.setSelectedPantryId,
    });
  });

  it('passes options to useHomeInvitations', () => {
    renderHook(() => useHomeManagement());

    const { useHomeInvitations } = jest.requireMock('../useHomeInvitations');
    expect(useHomeInvitations).toHaveBeenCalledWith({
      homes: mockHomeQuery.homes,
      refetch: mockHomeQuery.refetch,
      setDefaultHome: mockHomeSelection.setDefaultHome,
      setSelectedHomeId: mockHomeSelection.setSelectedHomeId,
    });
  });
});

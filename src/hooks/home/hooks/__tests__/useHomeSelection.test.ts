import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { SetDefaultHomeDocument } from '#operations/home/userSettings.generated';
import { alertService } from '#/services/alertService';
import { useHomeSelection } from '../useHomeSelection';

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
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  useSelectedPantryId: jest.fn(() => mockStoreState.selectedPantryId),
  useSetSelectedPantryId: jest.fn(() => mockStoreState.setSelectedPantryId),
  useHomeState: jest.fn(() => ({
    selectedHomeId: mockStoreState.selectedHomeId,
    setSelectedHomeId: mockStoreState.setSelectedHomeId,
  })),
  useSetHomeAndPantry: jest.fn(() => mockStoreState.setHomeAndPantry),
  useSetIsHomeSelectionReady: jest.fn(
    () => mockStoreState.setIsHomeSelectionReady,
  ),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Error message' })),
  }),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

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
});

function setDefaultMock(defaultPantryId: string | null = null) {
  return recordMock(SetDefaultHomeDocument, {
    data: {
      setDefaultHome: {
        __typename: 'SetDefaultHomeSuccess',
        settings: {
          __typename: 'UserSettings',
          id: 'settings-1',
        },
        defaultPantry: defaultPantryId
          ? { __typename: 'Pantry', id: defaultPantryId }
          : null,
      },
    },
  });
}

function setDefaultFailureMock() {
  return recordMock(SetDefaultHomeDocument, {
    data: {
      setDefaultHome: {
        __typename: 'NotFoundError',
        message: 'Home not found',
      },
    },
  });
}

function setDefaultErrorMock() {
  return recordMock(SetDefaultHomeDocument, {
    error: new Error('Network error'),
  });
}

describe('useHomeSelection', () => {
  it('returns selection state', () => {
    const { result } = renderHookWithApollo(() =>
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

    const { result } = renderHookWithApollo(() =>
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

    const { result } = renderHookWithApollo(() =>
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

    const { result } = renderHookWithApollo(() =>
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
      const m = setDefaultMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: 'home-1',
            loading: false,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-1');
      });

      expect(success!).toBe(true);
      expect(m.fired).toEqual([]);
    });

    it('shows error for empty homeId', async () => {
      const m = setDefaultMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
            loading: false,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('');
      });

      expect(success!).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Invalid home ID',
      );
    });

    it('shows error when home not found in list', async () => {
      const m = setDefaultMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
            loading: false,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('nonexistent-home');
      });

      expect(success!).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Home not found',
      );
    });

    it('calls mutation and updates state on success', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';
      const m = setDefaultMock('pantry-3');

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: 'home-1',
            loading: false,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(true);
      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
        false,
      );
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
        'home-2',
        'pantry-3',
      );
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-3',
      );
    });

    it('rolls back on mutation failure', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
            loading: false,
          }),
        { operationMocks: [setDefaultErrorMock().mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(false);
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
        'home-1',
        'pantry-1',
      );
    });

    it('rolls back when mutation returns success: false', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';
      const m = setDefaultFailureMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
            loading: false,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(false);
    });
  });

  it('exposes setSelectedHomeId and setSelectedPantryId', () => {
    const { result } = renderHookWithApollo(() =>
      useHomeSelection({
        homes: [],
        remoteDefaultHomeId: null,
        loading: false,
      }),
    );

    expect(result.current.setSelectedHomeId).toBe(
      mockStoreState.setSelectedHomeId,
    );
    expect(result.current.setSelectedPantryId).toBe(
      mockStoreState.setSelectedPantryId,
    );
  });
});

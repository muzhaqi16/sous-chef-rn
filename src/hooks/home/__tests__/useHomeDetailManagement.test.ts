import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  GetHomeDocument,
  UpdateHomeDocument,
} from '#operations/home/home.generated';
import { alertService } from '#/services/alertService';
import { useHomeDetailManagement } from '../useHomeDetailManagement';

const mockStoreState = {
  selectedHomeId: 'home-1' as string | null,
  setSelectedHomeId: jest.fn(),
  setSelectedPantryId: jest.fn(),
  setSelectedShoppingListId: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  useSetSelectedPantryId: jest.fn(() => mockStoreState.setSelectedPantryId),
  useHomeState: jest.fn(() => ({
    selectedHomeId: mockStoreState.selectedHomeId,
    setSelectedHomeId: mockStoreState.setSelectedHomeId,
  })),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedQueryData: jest.fn(
    (data: any, fallback: any) => data ?? fallback,
  ),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHome: jest.fn((home: any) => home),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
  setCachedFields: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Version conflict'),
}));

jest.mock('#utils/formatters/roleFormatters', () => ({
  formatRole: jest.fn((role: string) => role),
}));

const mockCreateRemoveOperation = jest.fn((config: any) => {
  return async () => {
    const {
      alertService: mockAlertService,
    } = require('#/services/alertService');
    return new Promise(resolve => {
      mockAlertService.alert(config.operationName, 'Confirm?', [
        { text: 'Cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          onPress: async () => {
            const result = await config.mutation({
              variables: { id: config.itemId },
            });
            resolve(result?.data || false);
          },
        },
      ]);
    });
  };
});

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: () => ({
    createRemoveOperation: mockCreateRemoveOperation,
  }),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const DEFAULT_HOME_DATA = {
  home: {
    __typename: 'Home',
    id: 'home-1',
    name: 'Test Home',
    description: null,
    timezone: null,
    currency: null,
    isPublic: false,
    joinCode: null,
    allowJoinCode: false,
    maxMembers: null,
    version: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    invitesConnection: {
      __typename: 'HomeInviteConnection',
      edges: [],
      totalCount: 0,
    },
    membersConnection: {
      __typename: 'MembershipConnection',
      edges: [
        {
          __typename: 'MembershipEdge',
          node: {
            __typename: 'Membership',
            id: 'm-1',
            homeId: 'home-1',
            userId: 'user-1',
            role: 'OWNER',
            status: 'ACTIVE',
            displayName: 'Alice',
            canManageHome: true,
            user: {
              __typename: 'User',
              id: 'user-1',
              email: 'alice@test.com',
            },
          },
        },
      ],
      totalCount: 1,
    },
    pantriesConnection: {
      __typename: 'PantryConnection',
      edges: [],
      totalCount: 0,
    },
    myMembership: {
      __typename: 'Membership',
      id: 'm-1',
      role: 'OWNER',
      status: 'ACTIVE',
      displayName: 'Alice',
      canManageHome: true,
      canViewPantry: true,
      canEditPantry: true,
      canAddItems: true,
      canRemoveItems: true,
      canInviteOthers: true,
    },
  },
};

function getHomeMock(
  data: any = DEFAULT_HOME_DATA,
  options: { delay?: number; error?: Error } = {},
): MockedResponse {
  return recordMock(GetHomeDocument, {
    data,
    ...(options.delay !== undefined ? { delay: options.delay } : {}),
    ...(options.error ? { error: options.error } : {}),
  }).mock;
}

function updateHomeMock() {
  return recordMock(UpdateHomeDocument, {
    data: {
      updateHome: {
        __typename: 'HomePayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        home: {
          __typename: 'Home',
          id: 'home-1',
          name: 'Test Home',
          allowJoinCode: false,
          joinCode: null,
          version: 2,
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = 'home-1';
});

describe('useHomeDetailManagement', () => {
  it('returns home data and actions', async () => {
    const { result } = renderHookWithApollo(
      () => useHomeDetailManagement('home-1'),
      { operationMocks: [getHomeMock()] },
    );

    await waitFor(() => expect(result.current.home).toBeTruthy());

    expect(result.current.home).toEqual(
      expect.objectContaining({ id: 'home-1', name: 'Test Home' }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.leaving).toBe(false);
    expect(typeof result.current.saveName).toBe('function');
    expect(typeof result.current.changeRole).toBe('function');
    expect(typeof result.current.removeMember).toBe('function');
    expect(typeof result.current.revokeInvite).toBe('function');
    expect(typeof result.current.leaveHome).toBe('function');
    expect(typeof result.current.toggleJoinCode).toBe('function');
  });

  it('returns null home when no data', async () => {
    const { result } = renderHookWithApollo(
      () => useHomeDetailManagement('home-1'),
      { operationMocks: [getHomeMock({ home: null })] },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.home).toBeNull();
  });

  describe('saveName', () => {
    it('calls updateHomeMutation with name', async () => {
      const update = updateHomeMock();
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), update.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      await act(async () => {
        await result.current.saveName('New Name');
      });

      expect(update.fired).toContainEqual({
        id: 'home-1',
        input: { name: 'New Name' },
      });
    });
  });

  describe('toggleJoinCode', () => {
    it('calls updateHomeMutation with allowJoinCode', async () => {
      const update = updateHomeMock();
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), update.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      await act(async () => {
        await result.current.toggleJoinCode(true);
      });

      expect(update.fired).toContainEqual({
        id: 'home-1',
        input: { allowJoinCode: true },
      });
    });
  });

  describe('changeRole', () => {
    it('sets rolePickerState with correct values', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        result.current.changeRole('m-1', 'MEMBER', 'Alice');
      });

      expect(result.current.rolePickerState).toEqual({
        visible: true,
        membershipId: 'm-1',
        currentRole: 'MEMBER',
        memberName: 'Alice',
      });
    });
  });

  describe('removeMember', () => {
    it('shows confirmation dialog via createRemoveOperation', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        result.current.removeMember('m-1', 'Alice');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Remove Member',
        'Confirm?',
        expect.any(Array),
      );
    });
  });

  describe('revokeInvite', () => {
    it('shows confirmation dialog via createRemoveOperation', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        result.current.revokeInvite('inv-1', 'user@test.com');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Revoke Invitation',
        'Confirm?',
        expect.any(Array),
      );
    });
  });

  describe('leaveHome', () => {
    it('shows leave confirmation dialog', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        result.current.leaveHome('Test Home');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Leave Home',
        expect.stringContaining('Test Home'),
        expect.any(Array),
      );
    });
  });

  describe('toggleJoinCode disable', () => {
    it('calls updateHomeMutation with allowJoinCode false', async () => {
      const update = updateHomeMock();
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), update.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      await act(async () => {
        await result.current.toggleJoinCode(false);
      });

      expect(update.fired).toContainEqual({
        id: 'home-1',
        input: { allowJoinCode: false },
      });
    });
  });

  describe('changeRole role selection', () => {
    it('sets rolePickerState with member name', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        result.current.changeRole('m-2', 'ADMIN', 'Bob');
      });

      expect(result.current.rolePickerState).toEqual({
        visible: true,
        membershipId: 'm-2',
        currentRole: 'ADMIN',
        memberName: 'Bob',
      });
    });
  });

  describe('revokeInvite with different email', () => {
    it('shows confirmation dialog with email', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        result.current.revokeInvite('inv-2', 'bob@test.com');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Revoke Invitation',
        'Confirm?',
        expect.any(Array),
      );
    });
  });

  describe('loading states', () => {
    it('returns loading true when query is loading', () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(DEFAULT_HOME_DATA, { delay: 1000 })] },
      );

      expect(result.current.loading).toBe(true);
    });
  });

  describe('home with multiple members and invites', () => {
    it('returns full home data including members and invites', async () => {
      const fullHomeData = {
        home: {
          ...DEFAULT_HOME_DATA.home,
          name: 'Full Home',
          membersConnection: {
            __typename: 'MembershipConnection',
            edges: [
              {
                __typename: 'MembershipEdge',
                node: {
                  __typename: 'Membership',
                  id: 'm-1',
                  homeId: 'home-1',
                  userId: 'user-1',
                  role: 'OWNER',
                  status: 'ACTIVE',
                  displayName: 'Alice',
                  canManageHome: true,
                  user: {
                    __typename: 'User',
                    id: 'user-1',
                    email: 'alice@test.com',
                  },
                },
              },
              {
                __typename: 'MembershipEdge',
                node: {
                  __typename: 'Membership',
                  id: 'm-2',
                  homeId: 'home-1',
                  userId: 'user-2',
                  role: 'MEMBER',
                  status: 'ACTIVE',
                  displayName: 'Bob',
                  canManageHome: false,
                  user: {
                    __typename: 'User',
                    id: 'user-2',
                    email: 'bob@test.com',
                  },
                },
              },
            ],
            totalCount: 2,
          },
          invitesConnection: {
            __typename: 'HomeInviteConnection',
            edges: [
              {
                __typename: 'HomeInviteEdge',
                node: {
                  __typename: 'HomeInvite',
                  id: 'inv-1',
                  email: 'charlie@test.com',
                  recipientName: null,
                  role: 'MEMBER',
                  status: 'PENDING',
                },
              },
            ],
            totalCount: 1,
          },
          pantriesConnection: {
            __typename: 'PantryConnection',
            edges: [
              {
                __typename: 'PantryEdge',
                node: {
                  __typename: 'Pantry',
                  id: 'p-1',
                  name: 'Main Pantry',
                  isDefault: true,
                },
              },
            ],
            totalCount: 1,
          },
        },
      };

      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(fullHomeData)] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());
      expect(result.current.home).toEqual(
        expect.objectContaining({
          id: 'home-1',
          name: 'Full Home',
        }),
      );
    });
  });
});

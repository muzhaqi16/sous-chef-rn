import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { useHomeDetailManagement } from '../useHomeDetailManagement';

const mockGetHomeQuery = {
  data: undefined as any,
  loading: false,
  refetch: jest.fn(),
};

const mockUpdateHomeMutation = jest.fn();
const mockUpdateMembershipMutation = jest.fn();
const mockRemoveMemberMutation = jest.fn();
const mockRevokeInviteMutation = jest.fn();
const mockLeaveHomeMutation = jest.fn();
const mockSetDefaultHomeMutation = jest.fn();
const mockLeaveClient = {
  cache: {
    readQuery: jest.fn(() => null),
  },
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetHomeQuery: jest.fn(() => mockGetHomeQuery),
  useUpdateHomeMutation: jest.fn(() => [
    mockUpdateHomeMutation,
    { loading: false },
  ]),
  useUpdateMembershipMutation: jest.fn(() => [mockUpdateMembershipMutation]),
  useRemoveMemberMutation: jest.fn(() => [mockRemoveMemberMutation]),
  useRevokeHomeInviteMutation: jest.fn(() => [mockRevokeInviteMutation]),
  useLeaveHomeMutation: jest.fn(() => [
    mockLeaveHomeMutation,
    { loading: false, client: mockLeaveClient },
  ]),
  useSetDefaultHomeMutation: jest.fn(() => [mockSetDefaultHomeMutation]),
}));

const mockStoreState = {
  selectedHomeId: 'home-1' as string | null,
  setSelectedHomeId: jest.fn(),
  setSelectedPantryId: jest.fn(),
  setSelectedShoppingListId: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  selectSelectedHomeId: (state: any) => state.selectedHomeId,
  selectHomeState: (state: any) => ({
    selectedHomeId: state.selectedHomeId,
    setSelectedHomeId: state.setSelectedHomeId,
  }),
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
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Version conflict'),
}));

jest.mock('#constants/messages', () => ({
  MESSAGES: {
    errors: {
      updateHomeNameFailed: 'Failed to update home name',
      updateMemberRoleFailed: 'Failed to update role',
      removeMemberFailed: 'Failed to remove member',
      revokeInviteFailed: 'Failed to revoke invite',
    },
  },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = 'home-1';
  mockGetHomeQuery.data = {
    home: {
      id: 'home-1',
      name: 'Test Home',
      members: [
        { id: 'm-1', userId: 'user-1', role: 'OWNER', user: { name: 'Alice' } },
      ],
      invites: [],
      pantries: [],
    },
  };
  mockGetHomeQuery.loading = false;
});

describe('useHomeDetailManagement', () => {
  it('returns home data and actions', () => {
    const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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

  it('returns null home when no data', () => {
    mockGetHomeQuery.data = undefined;

    const { result } = renderHook(() => useHomeDetailManagement('home-1'));

    expect(result.current.home).toBeNull();
  });

  describe('saveName', () => {
    it('calls updateHomeMutation with name', async () => {
      mockUpdateHomeMutation.mockResolvedValue({});

      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

      await act(async () => {
        await result.current.saveName('New Name');
      });

      expect(mockUpdateHomeMutation).toHaveBeenCalledWith({
        variables: {
          id: 'home-1',
          input: { name: 'New Name' },
        },
      });
    });
  });

  describe('toggleJoinCode', () => {
    it('calls updateHomeMutation with allowJoinCode', async () => {
      mockUpdateHomeMutation.mockResolvedValue({});

      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

      await act(async () => {
        await result.current.toggleJoinCode(true);
      });

      expect(mockUpdateHomeMutation).toHaveBeenCalledWith({
        variables: {
          id: 'home-1',
          input: { allowJoinCode: true },
        },
      });
    });
  });

  describe('changeRole', () => {
    it('sets rolePickerState with correct values', () => {
      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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
    it('shows confirmation dialog via createRemoveOperation', () => {
      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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
    it('shows confirmation dialog via createRemoveOperation', () => {
      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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
    it('shows leave confirmation dialog', () => {
      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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

  describe('saveName with failure', () => {
    it('handles saveName rejection gracefully', async () => {
      mockUpdateHomeMutation.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

      await act(async () => {
        try {
          await result.current.saveName('Failed Name');
        } catch {
          // expected
        }
      });

      expect(mockUpdateHomeMutation).toHaveBeenCalled();
    });
  });

  describe('toggleJoinCode disable', () => {
    it('calls updateHomeMutation with allowJoinCode false', async () => {
      mockUpdateHomeMutation.mockResolvedValue({});

      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

      await act(async () => {
        await result.current.toggleJoinCode(false);
      });

      expect(mockUpdateHomeMutation).toHaveBeenCalledWith({
        variables: {
          id: 'home-1',
          input: { allowJoinCode: false },
        },
      });
    });
  });

  describe('changeRole role selection', () => {
    it('sets rolePickerState with member name', () => {
      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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
    it('shows confirmation dialog with email', () => {
      const { result } = renderHook(() => useHomeDetailManagement('home-1'));

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
      mockGetHomeQuery.loading = true;

      const { result } = renderHook(() => useHomeDetailManagement('home-1'));
      expect(result.current.loading).toBe(true);

      mockGetHomeQuery.loading = false;
    });
  });

  describe('home with multiple members and invites', () => {
    it('returns full home data including members and invites', () => {
      mockGetHomeQuery.data = {
        home: {
          id: 'home-1',
          name: 'Full Home',
          members: [
            {
              id: 'm-1',
              userId: 'user-1',
              role: 'OWNER',
              user: { name: 'Alice' },
            },
            {
              id: 'm-2',
              userId: 'user-2',
              role: 'MEMBER',
              user: { name: 'Bob' },
            },
          ],
          invites: [{ id: 'inv-1', email: 'charlie@test.com', role: 'MEMBER' }],
          pantries: [{ id: 'p-1', name: 'Main Pantry' }],
        },
      };

      const { result } = renderHook(() => useHomeDetailManagement('home-1'));
      expect(result.current.home).toEqual(
        expect.objectContaining({
          id: 'home-1',
          name: 'Full Home',
        }),
      );
    });
  });
});

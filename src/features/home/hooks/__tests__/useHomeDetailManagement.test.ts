import { act, waitFor } from '@testing-library/react-native';
import { ErrorCode, MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  GetHomeDocument,
  UpdateHomeDocument,
  EnableHomeJoinLinkDocument,
  UpdateHomeJoinCodeDocument,
  TransferHomeOwnershipDocument,
  UpdateMembershipDocument,
  RemoveMemberDocument,
} from '#operations/home/home.generated';
import { alertService } from '#/services/alertService';
import type { RootState } from '#store/index';
import { useHomeDetailManagement } from '../useHomeDetailManagement';

const mockStoreState = {
  selectedHomeId: 'home-1' as string | null,
  setSelectedHomeId: jest.fn(),
  setSelectedPantryId: jest.fn(),
  setSelectedShoppingListId: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector(mockStoreState as Partial<RootState> as RootState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  useSetSelectedPantryId: jest.fn(() => mockStoreState.setSelectedPantryId),
  useHomeState: jest.fn(() => ({
    selectedHomeId: mockStoreState.selectedHomeId,
    setSelectedHomeId: mockStoreState.setSelectedHomeId,
  })),
}));

// The verification gate is exercised in its own suite; here it always allows
// the action so these tests stay focused on their own behaviour.
jest.mock('#hooks/auth/useEmailVerification', () => ({
  useVerifiedEmailGate: () => ({
    requireVerifiedEmail: () => true,
    hasUnverifiedEmail: false,
  }),
  useEmailVerificationActions: () => ({
    skipVerification: jest.fn(),
    resumeVerification: jest.fn(),
  }),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedQueryData: jest.fn(
    <T>(data: T | undefined, fallback: T): T => data ?? fallback,
  ),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHome: jest.fn(<T>(home: T): T => home),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
  setCachedFields: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#utils/formatters/roleFormatters', () => ({
  formatRole: jest.fn((role: string) => role),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

type AlertButton = { style?: string; onPress?: () => unknown };

/** Presses the destructive button of the most recent confirmation dialog. */
const confirmLastAlert = async () => {
  const buttons = (alertService.alert as jest.Mock).mock.lastCall?.[2] as
    | AlertButton[]
    | undefined;
  await buttons?.find(button => button.style === 'destructive')?.onPress?.();
};

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
    joinLink: null,
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
            canViewPantry: true,
            canEditPantry: true,
            canAddItems: true,
            canRemoveItems: true,
            canInviteOthers: true,
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
  data: Record<string, unknown> = DEFAULT_HOME_DATA,
  options: { delay?: number; error?: Error } = {},
): MockedResponse {
  return recordMock(GetHomeDocument, {
    data,
    ...(options.delay !== undefined ? { delay: options.delay } : {}),
    ...(options.error ? { error: options.error } : {}),
  }).mock;
}

function enableJoinLinkMock() {
  return recordMock(EnableHomeJoinLinkDocument, {
    data: {
      enableHomeJoinLink: {
        __typename: 'UpdateHomePayload',
        home: {
          __typename: 'Home',
          id: 'home-1',
          allowJoinCode: true,
          joinCode: 'ABC123',
          joinLink: {
            __typename: 'ShareLink',
            universal: 'https://x/join/ABC123',
            scheme: 'souschef://join/ABC123',
          },
          version: 2,
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      },
    },
  });
}

function updateHomeMock() {
  return recordMock(UpdateHomeDocument, {
    data: {
      updateHome: {
        __typename: 'UpdateHomePayload',
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
        input: { id: 'home-1', name: 'New Name', version: 1 },
      });
    });

    // A refusal resolves as a union member, so nothing threw and nothing
    // alerted: the name snapped back with no word said.
    it('says so once, in the app’s own words, when the server refuses', async () => {
      const refused = recordMock(UpdateHomeDocument, {
        data: {
          updateHome: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'SERVER PROSE',
            field: null,
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), refused.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      await act(async () => {
        await result.current.saveName('New Name');
      });

      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(alertService.alert).not.toHaveBeenCalledWith(
        expect.anything(),
        'SERVER PROSE',
      );
      await waitFor(() => expect(result.current.home?.name).toBe('Test Home'));
    });
  });

  describe('toggleJoinCode', () => {
    it('enabling fires the dedicated enableHomeJoinLink mutation', async () => {
      const enable = enableJoinLinkMock();
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), enable.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      await act(async () => {
        await result.current.toggleJoinCode(true);
      });

      expect(enable.fired).toContainEqual({ input: { id: 'home-1' } });
    });
  });

  describe('rotateJoinCode', () => {
    it('fires updateHomeJoinCode for the home', async () => {
      const rotate = recordMock(UpdateHomeJoinCodeDocument, {
        data: {
          updateHomeJoinCode: {
            __typename: 'UpdateHomePayload',
            home: {
              __typename: 'Home',
              id: 'home-1',
              allowJoinCode: true,
              joinCode: 'NEW999',
              joinLink: {
                __typename: 'ShareLink',
                universal: 'https://x/join/NEW999',
                scheme: 'souschef://join/NEW999',
              },
              version: 3,
              updatedAt: '2025-01-03T00:00:00.000Z',
            },
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), rotate.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.rotateJoinCode();
      });

      expect(ok).toBe(true);
      expect(rotate.fired).toContainEqual({ input: { id: 'home-1' } });
    });
  });

  describe('transferOwnership', () => {
    it('fires transferHomeOwnership and returns false on a rejection', async () => {
      const transfer = recordMock(TransferHomeOwnershipDocument, {
        data: {
          transferHomeOwnership: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'not owner',
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), transfer.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.transferOwnership('user-2');
      });

      expect(ok).toBe(false);
      expect(transfer.fired).toContainEqual({
        input: { homeId: 'home-1', newOwnerId: 'user-2' },
      });
    });

    it('refuses a second transfer while the first is in flight', async () => {
      const transfer = recordMock(TransferHomeOwnershipDocument, {
        delay: 50,
        data: {
          transferHomeOwnership: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'not owner',
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), transfer.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());
      expect(result.current.transferringOwnership).toBe(false);

      let first: Promise<boolean> | undefined;
      let second: boolean | undefined;
      await act(async () => {
        first = result.current.transferOwnership('user-2');
        second = await result.current.transferOwnership('user-3');
      });

      expect(second).toBe(false);
      expect(result.current.transferringOwnership).toBe(true);

      await act(async () => {
        await first;
      });

      expect(result.current.transferringOwnership).toBe(false);
      expect(transfer.fired).toEqual([
        { input: { homeId: 'home-1', newOwnerId: 'user-2' } },
      ]);
    });
  });

  describe('updateMemberPermission', () => {
    it('fires updateMembership with the single permission override', async () => {
      const perm = recordMock(UpdateMembershipDocument, {
        data: {
          updateMembership: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'nope',
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), perm.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      await act(async () => {
        await result.current.updateMemberPermission('m-1', 'canAddItems', true);
      });

      expect(perm.fired).toContainEqual({
        input: { id: 'm-1', canAddItems: true },
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
        result.current.changeRole('m-1', MembershipRole.Member, 'Alice');
      });

      expect(result.current.rolePickerState).toEqual({
        visible: true,
        membershipId: 'm-1',
        currentRole: MembershipRole.Member,
        memberName: 'Alice',
      });
    });
  });

  describe('removeMember', () => {
    it('asks for confirmation naming the member', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        void result.current.removeMember('m-1', 'Alice');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Remove Member',
        expect.stringContaining('Alice'),
        expect.any(Array),
      );
    });

    // `RemoveMemberInput` keys the member as `membershipId`; the shared removal
    // builder sends `{ id }`, which the schema refuses outright.
    it('sends the input its mutation names once confirmed', async () => {
      const remove = recordMock(RemoveMemberDocument, {
        data: {
          removeMember: {
            __typename: 'RemoveMemberPayload',
            membership: { __typename: 'Membership', id: 'm-1' },
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), remove.mock] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      let removed: Promise<boolean> | undefined;
      act(() => {
        removed = result.current.removeMember('m-1', 'Alice');
      });
      await act(async () => {
        await confirmLastAlert();
      });

      await expect(removed).resolves.toBe(true);
      expect(remove.fired).toEqual([{ input: { membershipId: 'm-1' } }]);
    });
  });

  describe('revokeInvite', () => {
    it('asks for confirmation naming the invitee', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock()] },
      );

      await waitFor(() => expect(result.current.home).toBeTruthy());

      act(() => {
        void result.current.revokeInvite('inv-1', 'user@test.com');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Revoke Invitation',
        expect.stringContaining('user@test.com'),
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
        // Settles only when a dialog button is pressed, which this case never does.
        void result.current.leaveHome('Test Home');
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
        input: { id: 'home-1', allowJoinCode: false, version: 1 },
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
        result.current.changeRole('m-2', MembershipRole.Admin, 'Bob');
      });

      expect(result.current.rolePickerState).toEqual({
        visible: true,
        membershipId: 'm-2',
        currentRole: MembershipRole.Admin,
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
        void result.current.revokeInvite('inv-2', 'bob@test.com');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Revoke Invitation',
        expect.stringContaining('bob@test.com'),
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
                  canViewPantry: true,
                  canEditPantry: true,
                  canAddItems: true,
                  canRemoveItems: true,
                  canInviteOthers: true,
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
                  canViewPantry: true,
                  canEditPantry: false,
                  canAddItems: true,
                  canRemoveItems: false,
                  canInviteOthers: false,
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
                  expiresAt: '2026-12-31T00:00:00.000Z',
                  message: null,
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

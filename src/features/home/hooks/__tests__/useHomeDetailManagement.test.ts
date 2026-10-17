import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { t } from '#/i18n';
import { ErrorCode, MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
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
  LeaveHomeDocument,
} from '#operations/home/home.generated';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
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

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
}));

jest.mock('#utils/formatters/roleFormatters', () => ({
  formatRole: jest.fn((role: string) => role),
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
            version: 3,
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

  // `updateMembership` requires the version read: the server refuses a stale
  // one, so each write states what the cache holds for that membership.
  describe('a membership write', () => {
    const READ_MEMBERSHIP = gql`
      fragment _readMembership on Membership {
        id
        version
        role
        canAddItems
      }
    `;
    const readMembership = (cache: ReturnType<typeof makeCache>, id: string) =>
      cache.readFragment<{
        version: number;
        role: MembershipRole;
        canAddItems: boolean;
      }>({ id: `Membership:${id}`, fragment: READ_MEMBERSHIP });

    /** Answers with the membership as written, one version on. */
    const appliedMock = () =>
      recordMock(UpdateMembershipDocument, {
        dataFor: (vars): MockDataFor<typeof UpdateMembershipDocument> => {
          const { id, version, ...written } = inputOf(vars);
          return {
            updateMembership: {
              __typename: 'UpdateMembershipPayload',
              membership: {
                __typename: 'Membership',
                id: String(id),
                version: Number(version) + 1,
                ...written,
              },
            },
          };
        },
      });

    const refusedMock = () =>
      recordMock(UpdateMembershipDocument, {
        data: {
          updateMembership: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'nope',
          },
        },
      });

    const renderLoaded = async (
      update: ReturnType<typeof recordMock>,
      cache = makeCache(),
    ) => {
      const rendered = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        { operationMocks: [getHomeMock(), update.mock], cache },
      );
      await waitFor(() => expect(rendered.result.current.home).toBeTruthy());
      return { ...rendered, cache };
    };

    describe('updateMemberPermission', () => {
      it('sends the single permission override at the cached version', async () => {
        const update = appliedMock();
        const { result, cache } = await renderLoaded(update);
        expect(readMembership(cache, 'm-1')).toMatchObject({
          version: 3,
          canAddItems: true,
        });

        let updated: unknown = 'unset';
        await act(async () => {
          updated = await result.current.updateMemberPermission(
            'm-1',
            'canAddItems',
            false,
          );
        });

        expect(updated).toBe(true);
        expect(update.fired).toEqual([
          { input: { id: 'm-1', canAddItems: false, version: 3 } },
        ]);
        // The answer normalizes: the toggle and the next write's version.
        expect(readMembership(cache, 'm-1')).toMatchObject({
          version: 4,
          canAddItems: false,
        });
        expect(alertService.alert).not.toHaveBeenCalled();
      });

      it('sends a second override at the version the first answered with', async () => {
        const update = appliedMock();
        const { result } = await renderLoaded(update);

        await act(async () => {
          await Promise.all([
            result.current.updateMemberPermission('m-1', 'canAddItems', false),
            result.current.updateMemberPermission(
              'm-1',
              'canRemoveItems',
              false,
            ),
          ]);
        });

        expect(update.fired).toEqual([
          { input: { id: 'm-1', canAddItems: false, version: 3 } },
          { input: { id: 'm-1', canRemoveItems: false, version: 4 } },
        ]);
      });

      it('reports a refusal as failed and leaves the membership as it was', async () => {
        const update = refusedMock();
        const { result, cache } = await renderLoaded(update);

        let updated: unknown = 'unset';
        await act(async () => {
          updated = await result.current.updateMemberPermission(
            'm-1',
            'canAddItems',
            false,
          );
        });

        expect(updated).toBe(false);
        expect(update.fired).toEqual([
          { input: { id: 'm-1', canAddItems: false, version: 3 } },
        ]);
        expect(readMembership(cache, 'm-1')).toMatchObject({
          version: 3,
          canAddItems: true,
        });
        expect(alertService.alert).toHaveBeenCalledTimes(1);
      });

      it('sends nothing and settles as failed for a membership with no cached version', async () => {
        const update = appliedMock();
        const { result } = await renderLoaded(update);

        let updated: unknown = 'unset';
        await act(async () => {
          updated = await result.current.updateMemberPermission(
            'm-unread',
            'canAddItems',
            false,
          );
        });

        // The API refuses an edit that states no version, so none is sent.
        expect(updated).toBe(false);
        expect(update.fired).toEqual([]);
        expect(alertService.alert).toHaveBeenCalledWith(
          t('labels.error'),
          t('errors.updateMemberRoleFailed'),
        );
      });
    });

    describe('handleRoleSelect', () => {
      it('sends the picked role at the cached version', async () => {
        const update = appliedMock();
        const { result, cache } = await renderLoaded(update);

        act(() => {
          result.current.changeRole('m-1', MembershipRole.Owner, 'Alice');
        });
        await act(async () => {
          await result.current.handleRoleSelect(MembershipRole.Admin);
        });

        expect(update.fired).toEqual([
          { input: { id: 'm-1', role: MembershipRole.Admin, version: 3 } },
        ]);
        expect(readMembership(cache, 'm-1')).toMatchObject({
          version: 4,
          role: MembershipRole.Admin,
        });
        expect(result.current.rolePickerState.visible).toBe(false);
        expect(alertService.alert).not.toHaveBeenCalled();
      });

      it('sends nothing when the role picked is the one already held', async () => {
        const update = appliedMock();
        const { result } = await renderLoaded(update);

        act(() => {
          result.current.changeRole('m-1', MembershipRole.Owner, 'Alice');
        });
        await act(async () => {
          await result.current.handleRoleSelect(MembershipRole.Owner);
        });

        expect(update.fired).toEqual([]);
        expect(result.current.rolePickerState.visible).toBe(false);
      });

      it('sends nothing and reports the failure for a membership with no cached version', async () => {
        const update = appliedMock();
        const { result } = await renderLoaded(update);

        act(() => {
          result.current.changeRole('m-unread', MembershipRole.Member, 'Bo');
        });
        await act(async () => {
          await result.current.handleRoleSelect(MembershipRole.Admin);
        });

        expect(update.fired).toEqual([]);
        expect(alertService.alert).toHaveBeenCalledWith(
          t('labels.error'),
          t('errors.updateMemberRoleFailed'),
        );
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

    describe('once confirmed', () => {
      // The eviction runs for real, so each case reads the cache it leaves.
      beforeEach(() => {
        const actual: typeof import('#/apollo/utils/cacheUpdaters') =
          jest.requireActual('#/apollo/utils/cacheUpdaters');
        jest.mocked(safeEvict).mockImplementation(actual.safeEvict);
      });
      afterEach(() => jest.mocked(safeEvict).mockReset());

      /** Leaves the loaded home, the server answering `leaveHome` with `answer`. */
      const leaveAnswered = async (
        answer: MockDataFor<typeof LeaveHomeDocument>['leaveHome'],
      ) => {
        const leave = recordMock(LeaveHomeDocument, {
          data: { leaveHome: answer },
        });
        const cache = makeCache();
        const { result } = renderHookWithApollo(
          () => useHomeDetailManagement('home-1'),
          { operationMocks: [getHomeMock(), leave.mock], cache },
        );
        await waitFor(() => expect(result.current.home).toBeTruthy());

        let leaving: Promise<boolean> | undefined;
        act(() => {
          leaving = result.current.leaveHome('Test Home');
        });
        await act(async () => {
          await confirmLastAlert();
        });
        const left = await leaving;
        return { left, fired: leave.fired, cache };
      };

      const holdsHome = (cache: ReturnType<typeof makeCache>) =>
        'Home:home-1' in cache.extract();

      it('takes the home out and moves the selection on', async () => {
        const { left, fired, cache } = await leaveAnswered({
          __typename: 'LeaveHomePayload',
          converged: false,
          membership: { __typename: 'Membership', id: 'm-1' },
        });

        expect(fired).toEqual([{ input: { homeId: 'home-1' } }]);
        expect(left).toBe(true);
        expect(holdsHome(cache)).toBe(false);
        expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(null);
        expect(mockStoreState.setSelectedShoppingListId).toHaveBeenCalledWith(
          null,
        );
      });

      // Leaving twice: the server reads the ended membership as the leave it
      // asked for, so the second answer is a success that names nobody.
      it('treats a repeat the server answers as converged as left, with no error', async () => {
        const { left, cache } = await leaveAnswered({
          __typename: 'LeaveHomePayload',
          converged: true,
          membership: null,
        });

        expect(left).toBe(true);
        expect(holdsHome(cache)).toBe(false);
        expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(null);
        // The confirmation only.
        expect(alertService.alert).toHaveBeenCalledTimes(1);
      });

      // No membership row at all — the home was deleted meanwhile — is not
      // found; the server holds nothing for the device to show either way.
      it('treats a repeat the server answers as not found as left, with no error', async () => {
        const { left, cache } = await leaveAnswered({
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          resource: 'Membership',
        });

        expect(left).toBe(true);
        expect(holdsHome(cache)).toBe(false);
        expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(null);
        expect(alertService.alert).toHaveBeenCalledTimes(1);
      });

      it('keeps the home and shows a refusal that is not a removal', async () => {
        const { left, cache } = await leaveAnswered({
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
        });

        expect(left).toBe(false);
        expect(holdsHome(cache)).toBe(true);
        expect(mockStoreState.setSelectedHomeId).not.toHaveBeenCalled();
        // The confirmation, then the refusal.
        expect(alertService.alert).toHaveBeenCalledTimes(2);
      });
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

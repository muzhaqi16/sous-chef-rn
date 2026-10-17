import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
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

type HomeData = MockDataFor<typeof GetHomeDocument>;

/** The home as the detail screen reads it; the SDL completes the rest. */
const DEFAULT_HOME_DATA: HomeData = {
  home: {
    id: 'home-1',
    name: 'Test Home',
    allowJoinCode: false,
    joinCode: null,
    version: 1,
    membersConnection: {
      edges: [{ node: { id: 'm-1', version: 3, canAddItems: true } }],
    },
  },
};

function getHomeMock(
  data: HomeData = DEFAULT_HOME_DATA,
  options: { delay?: number } = {},
): MockedResponse {
  return recordMock(GetHomeDocument, { data, ...options }).mock;
}

/** The hook over the loaded home, `mocks` answering its writes. */
const renderLoaded = async (
  mocks: MockedResponse[] = [],
  cache = makeCache(),
) => {
  const rendered = renderHookWithApollo(
    () => useHomeDetailManagement('home-1'),
    { operationMocks: [getHomeMock(), ...mocks], cache },
  );
  await waitFor(() => expect(rendered.result.current.home).toBeTruthy());
  return { ...rendered, cache };
};

const updateHomeMock = () =>
  recordMock(UpdateHomeDocument, {
    data: {
      updateHome: {
        __typename: 'UpdateHomePayload',
        home: { id: 'home-1', version: 2 },
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = 'home-1';
});

describe('useHomeDetailManagement', () => {
  it('returns home data and actions', async () => {
    const { result } = await renderLoaded();

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
      const { result } = await renderLoaded([update.mock]);

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
      const { result } = await renderLoaded([refused.mock]);

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
      const enable = recordMock(EnableHomeJoinLinkDocument, {
        data: {
          enableHomeJoinLink: {
            __typename: 'UpdateHomePayload',
            home: { id: 'home-1', allowJoinCode: true, version: 2 },
          },
        },
      });
      const { result } = await renderLoaded([enable.mock]);

      await act(async () => {
        await result.current.toggleJoinCode(true);
      });

      expect(enable.fired).toContainEqual({ input: { id: 'home-1' } });
    });

    it('calls updateHomeMutation with allowJoinCode false', async () => {
      const update = updateHomeMock();
      const { result } = await renderLoaded([update.mock]);

      await act(async () => {
        await result.current.toggleJoinCode(false);
      });

      expect(update.fired).toContainEqual({
        input: { id: 'home-1', allowJoinCode: false, version: 1 },
      });
    });
  });

  describe('rotateJoinCode', () => {
    it('fires updateHomeJoinCode for the home', async () => {
      const rotate = recordMock(UpdateHomeJoinCodeDocument, {
        data: {
          updateHomeJoinCode: {
            __typename: 'UpdateHomePayload',
            home: { id: 'home-1', joinCode: 'NEW999', version: 3 },
          },
        },
      });
      const { result } = await renderLoaded([rotate.mock]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.rotateJoinCode();
      });

      expect(ok).toBe(true);
      expect(rotate.fired).toContainEqual({ input: { id: 'home-1' } });
    });
  });

  describe('transferOwnership', () => {
    const refusedTransfer = (delay?: number) =>
      recordMock(TransferHomeOwnershipDocument, {
        data: {
          transferHomeOwnership: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
          },
        },
        ...(delay === undefined ? {} : { delay }),
      });

    it('fires transferHomeOwnership and returns false on a rejection', async () => {
      const transfer = refusedTransfer();
      const { result } = await renderLoaded([transfer.mock]);

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
      const transfer = refusedTransfer(50);
      const { result } = await renderLoaded([transfer.mock]);
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

    describe('updateMemberPermission', () => {
      it('sends the single permission override at the cached version', async () => {
        const update = appliedMock();
        const { result, cache } = await renderLoaded([update.mock]);
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

      it('reports a refusal as failed and leaves the membership as it was', async () => {
        const update = refusedMock();
        const { result, cache } = await renderLoaded([update.mock]);

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
    });

    describe('handleRoleSelect', () => {
      it('sends the picked role at the cached version', async () => {
        const update = appliedMock();
        const { result, cache } = await renderLoaded([update.mock]);

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
        const { result } = await renderLoaded([update.mock]);

        act(() => {
          result.current.changeRole('m-1', MembershipRole.Owner, 'Alice');
        });
        await act(async () => {
          await result.current.handleRoleSelect(MembershipRole.Owner);
        });

        expect(update.fired).toEqual([]);
        expect(result.current.rolePickerState.visible).toBe(false);
      });
    });
  });

  describe('changeRole', () => {
    it.each([
      [
        'sets rolePickerState with correct values',
        'm-1',
        MembershipRole.Member,
        'Alice',
      ],
      [
        'sets rolePickerState with member name',
        'm-2',
        MembershipRole.Admin,
        'Bob',
      ],
    ])('%s', async (_name, membershipId, currentRole, memberName) => {
      const { result } = await renderLoaded();

      act(() => {
        result.current.changeRole(membershipId, currentRole, memberName);
      });

      expect(result.current.rolePickerState).toEqual({
        visible: true,
        membershipId,
        currentRole,
        memberName,
      });
    });
  });

  describe('removeMember', () => {
    it('asks for confirmation naming the member', async () => {
      const { result } = await renderLoaded();

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
            membership: { id: 'm-1' },
          },
        },
      });
      const { result } = await renderLoaded([remove.mock]);

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
    it.each([
      ['asks for confirmation naming the invitee', 'inv-1', 'user@test.com'],
      ['shows confirmation dialog with email', 'inv-2', 'bob@test.com'],
    ])('%s', async (_name, inviteId, email) => {
      const { result } = await renderLoaded();

      act(() => {
        void result.current.revokeInvite(inviteId, email);
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Revoke Invitation',
        expect.stringContaining(email),
        expect.any(Array),
      );
    });
  });

  describe('leaveHome', () => {
    it('shows leave confirmation dialog', async () => {
      const { result } = await renderLoaded();

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
        const { result, cache } = await renderLoaded([leave.mock]);

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
          membership: { id: 'm-1' },
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
      const member = (id: string, displayName: string) => ({
        node: { id, displayName },
      });
      const { result } = renderHookWithApollo(
        () => useHomeDetailManagement('home-1'),
        {
          operationMocks: [
            getHomeMock({
              home: {
                id: 'home-1',
                name: 'Full Home',
                membersConnection: {
                  edges: [member('m-1', 'Alice'), member('m-2', 'Bob')],
                },
                invitesConnection: {
                  edges: [{ node: { id: 'inv-1', email: 'charlie@test.com' } }],
                },
                pantriesConnection: {
                  edges: [{ node: { id: 'p-1', name: 'Main Pantry' } }],
                },
              },
            }),
          ],
        },
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

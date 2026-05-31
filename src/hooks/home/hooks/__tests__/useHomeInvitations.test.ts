import { act } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  InviteToHomeDocument,
  JoinHomeByCodeDocument,
  GetHomeByJoinCodeDocument,
} from '#operations/home/home.generated';
import { alertService } from '#/services/alertService';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { useHomeInvitations } from '../useHomeInvitations';

type HomeInvitationsApi = ReturnType<typeof useHomeInvitations>;
type JoinResult = Awaited<ReturnType<HomeInvitationsApi['joinHomeByCode']>>;
// On the success path `joinHomeByCode` resolves to the membership, whose `role`
// is a masked fragment field. Optional fields (plus `__typename`) let the masked
// value be read for assertions without unmasking.
type JoinMembershipData = {
  __typename?: string;
  homeId?: string;
  role?: MembershipRole;
};
// `inviteToHome` is a result union and `homeInvite` is a masked fragment ref, so
// `id`/`role` aren't statically present on the precise type. These fields are
// optional here so the masked mutation data assigns through while keeping the
// success-path reads type-checked against the runtime mock values.
type InviteResultData = {
  inviteToHome?: {
    __typename?: string;
    homeInvite?: {
      __typename?: string;
      id?: string;
      role?: MembershipRole;
    } | null;
  } | null;
};
type PreviewResult = Awaited<
  ReturnType<HomeInvitationsApi['previewHomeByCode']>
>;

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Error occurred' })),
  }),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHome: jest.fn((home: unknown) => home),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const createOptions = () => ({
  homes: [],
  refetch: jest.fn().mockResolvedValue(undefined),
  setDefaultHome: jest.fn().mockResolvedValue(true),
  setSelectedHomeId: jest.fn(),
});

// MockedResponse builders. We omit fragment fields the hook doesn't read; the
// schema-level shape only matters for the cache update path which we mock.
function buildInviteMock(
  input: { homeId: string; email: string; role: MembershipRole },
  homeInviteId: string = 'invite-1',
): MockedResponse {
  return {
    request: {
      query: InviteToHomeDocument,
      variables: { input },
    },
    result: {
      data: {
        inviteToHome: {
          __typename: 'InviteToHomePayload',
          home: { __typename: 'Home', id: input.homeId, name: 'Home' },
          homeInvite: {
            __typename: 'HomeInvite',
            id: homeInviteId,
            token: 'tok-1',
            role: input.role,
            home: { __typename: 'Home', id: input.homeId, name: 'Home' },
            inviter: {
              __typename: 'User',
              id: 'u-inviter',
              email: 'inviter@test.com',
              profile: {
                __typename: 'UserProfile',
                id: 'p-inviter',
                displayName: 'Inviter',
              },
            },
          },
        },
      },
    },
  };
}

function buildJoinByCodeMock(
  joinCode: string,
  membershipFields: { homeId: string; role: MembershipRole } | null,
): MockedResponse {
  return {
    request: {
      query: JoinHomeByCodeDocument,
      variables: { input: { joinCode } },
    },
    result: {
      data: {
        joinHomeByCode: membershipFields
          ? {
              __typename: 'JoinHomeByCodePayload',
              home: {
                __typename: 'Home',
                id: membershipFields.homeId,
                name: 'Home',
              },
              membership: {
                __typename: 'Membership',
                id: 'mem-1',
                homeId: membershipFields.homeId,
                userId: 'u-1',
                role: membershipFields.role,
                status: 'ACTIVE',
                displayName: null,
                canManageHome: false,
                canViewPantry: true,
                canEditPantry: false,
                canAddItems: true,
                canRemoveItems: false,
                canInviteOthers: false,
                user: {
                  __typename: 'User',
                  id: 'u-1',
                  email: 'me@test.com',
                  profile: {
                    __typename: 'UserProfile',
                    id: 'p-1',
                    displayName: 'Me',
                    avatar: null,
                  },
                },
              },
            }
          : {
              __typename: 'NotFoundError',
              message: 'Home not found for join code',
            },
      },
    },
  };
}

function buildHomeByJoinCodeMock(
  joinCode: string,
  home: { id: string; name: string } | null,
): MockedResponse {
  return {
    request: {
      query: GetHomeByJoinCodeDocument,
      variables: { joinCode },
    },
    result: {
      data: {
        homeByJoinCode: home
          ? {
              __typename: 'Home',
              id: home.id,
              name: home.name,
              version: 1,
              updatedAt: '2025-01-01T00:00:00.000Z',
              isDefault: false,
              membersConnection: {
                __typename: 'MembershipConnection',
                edges: [],
                totalCount: 0,
              },
              invitesConnection: {
                __typename: 'HomeInviteConnection',
                edges: [],
                totalCount: 0,
              },
              pantriesConnection: {
                __typename: 'PantryConnection',
                edges: [],
                totalCount: 0,
              },
              myMembership: null,
            }
          : null,
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useHomeInvitations', () => {
  it('returns invitation functions and loading states', () => {
    const { result } = renderHookWithApollo(() =>
      useHomeInvitations(createOptions()),
    );

    expect(typeof result.current.inviteUserToHome).toBe('function');
    expect(typeof result.current.joinHomeByCode).toBe('function');
    expect(typeof result.current.previewHomeByCode).toBe('function');
    expect(result.current.inviting).toBe(false);
    expect(result.current.joiningByCode).toBe(false);
    expect(result.current.loadingPreview).toBe(false);
    expect(result.current.previewHome).toBeNull();
  });

  describe('inviteUserToHome', () => {
    it('calls mutation with trimmed email and default role', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [
            buildInviteMock({
              homeId: 'home-1',
              email: 'user@test.com',
              role: MembershipRole.Member,
            }),
          ],
        },
      );

      let returnValue: InviteResultData | null | undefined;
      await act(async () => {
        returnValue = await result.current.inviteUserToHome(
          'home-1',
          '  user@test.com  ',
        );
      });

      // If MockedProvider returned data, the call matched the variables (which
      // include the trimmed email). The hook returns `result.data`.
      expect(returnValue?.inviteToHome?.homeInvite?.id).toBe('invite-1');
    });

    it('uses specified role', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [
            buildInviteMock({
              homeId: 'home-1',
              email: 'admin@test.com',
              role: MembershipRole.Admin,
            }),
          ],
        },
      );

      let returnValue: InviteResultData | null | undefined;
      await act(async () => {
        returnValue = await result.current.inviteUserToHome(
          'home-1',
          'admin@test.com',
          MembershipRole.Admin,
        );
      });

      // Mock matches { role: ADMIN } — receiving data confirms the call
      // forwarded the requested role.
      expect(returnValue?.inviteToHome?.homeInvite?.role).toBe(
        MembershipRole.Admin,
      );
    });

    it('returns mutation data on success', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [
            buildInviteMock(
              {
                homeId: 'home-1',
                email: 'user@test.com',
                role: MembershipRole.Member,
              },
              'invite-1',
            ),
          ],
        },
      );

      let returnValue: InviteResultData | null | undefined;
      await act(async () => {
        returnValue = await result.current.inviteUserToHome(
          'home-1',
          'user@test.com',
        );
      });

      expect(returnValue?.inviteToHome?.homeInvite?.id).toBe('invite-1');
    });
  });

  describe('joinHomeByCode', () => {
    it('shows alert for empty join code', async () => {
      const { result } = renderHookWithApollo(() =>
        useHomeInvitations(createOptions()),
      );

      let success: JoinResult | undefined;
      await act(async () => {
        success = await result.current.joinHomeByCode('   ');
      });

      expect(success).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Please enter a join code',
      );
    });

    it('calls mutation with trimmed code and returns membership', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [
            buildJoinByCodeMock('ABC123', {
              homeId: 'home-1',
              role: MembershipRole.Member,
            }),
          ],
        },
      );

      let returnValue: JoinResult | undefined;
      await act(async () => {
        returnValue = await result.current.joinHomeByCode('  ABC123  ');
      });

      // Receiving membership confirms the mutation matched the trimmed code.
      const membership = returnValue as JoinMembershipData | undefined;
      expect(membership?.homeId).toBe('home-1');
      expect(membership?.role).toBe(MembershipRole.Member);
    });

    it('returns false when no membership returned', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [buildJoinByCodeMock('ABC123', null)],
        },
      );

      let returnValue: JoinResult | undefined;
      await act(async () => {
        returnValue = await result.current.joinHomeByCode('ABC123');
      });

      expect(returnValue).toBe(false);
    });
  });

  describe('previewHomeByCode', () => {
    it('returns null for empty code', async () => {
      const { result } = renderHookWithApollo(() =>
        useHomeInvitations(createOptions()),
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('  ');
      });

      expect(returnValue).toBeNull();
    });

    it('queries with trimmed code and returns home data', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [
            buildHomeByJoinCodeMock('XYZ789', {
              id: 'home-1',
              name: 'Test Home',
            }),
          ],
        },
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('  XYZ789  ');
      });

      expect(returnValue?.id).toBe('home-1');
      expect(returnValue?.name).toBe('Test Home');
    });

    it('returns null when query returns no home', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [buildHomeByJoinCodeMock('INVALID', null)],
        },
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('INVALID');
      });

      expect(returnValue).toBeNull();
    });

    it('returns null on error', async () => {
      // Apollo's mock link returns errors via error policy 'all' rather than
      // throwing. To exercise the error path of `executeMutation`, mock the
      // helper directly to return false (mirroring its behavior on rejection).
      const { executeMutation } = require('#/utils/compilerSafeWrappers');
      executeMutation.mockResolvedValueOnce(false);

      const { result } = renderHookWithApollo(() =>
        useHomeInvitations(createOptions()),
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('ABC123');
      });

      expect(returnValue).toBeNull();
    });
  });
});

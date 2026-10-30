import { act } from '@testing-library/react-native';
import { t, type TranslationKey } from '#/i18n';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  InviteToHomeDocument,
  JoinHomeByCodeDocument,
  ResolveShareLinkDocument,
} from '#operations/home/home.generated';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  MembershipRole,
  MembershipStatus,
  ShareLinkTargetType,
} from '#/graphql/generated/schemaTypes';
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
type PreviewResult = Awaited<
  ReturnType<HomeInvitationsApi['previewHomeByCode']>
>;

jest.mock('#/services/errorService');

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHome: jest.fn((home: unknown) => home),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

const createOptions = () => ({
  homes: [],
  refetch: jest.fn().mockResolvedValue(undefined),
  setSelectedHomeId: jest.fn(),
});

// MockedResponse builders. We omit fragment fields the hook doesn't read; the
// schema-level shape only matters for the cache update path which we mock.
function buildInviteMock(
  input: { homeId: string; email: string; role: MembershipRole },
  homeInviteId: string = 'invite-1',
): MockFor<typeof InviteToHomeDocument> {
  return {
    request: {
      query: InviteToHomeDocument,
      variables: { input },
    },
    result: {
      data: {
        inviteToHome: {
          // The payload's only selection is `homeInvite`.
          __typename: 'InviteToHomePayload',
          homeInvite: {
            __typename: 'HomeInvite',
            id: homeInviteId,
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
): MockFor<typeof JoinHomeByCodeDocument> {
  return {
    request: {
      query: JoinHomeByCodeDocument,
      variables: { input: { joinCode } },
    },
    result: {
      data: {
        joinHomeByCode: membershipFields
          ? {
              // The payload's only selection is `membership`, shaped by
              // `HomeMemberCard_member` — which carries neither `displayName`
              // nor the user's `profile`.
              __typename: 'JoinHomeByCodePayload',
              membership: {
                __typename: 'Membership',
                id: 'mem-1',
                homeId: membershipFields.homeId,
                userId: 'u-1',
                role: membershipFields.role,
                status: MembershipStatus.Active,
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

/** A code's preview: a home's, a list's (which previews no home), or none. */
function buildShareLinkMock(
  code: string,
  target: { homeId: string; name: string } | 'list' | null,
): MockFor<typeof ResolveShareLinkDocument> {
  return {
    request: { query: ResolveShareLinkDocument, variables: { code } },
    result: {
      data: {
        resolveShareLink:
          target === null
            ? null
            : target === 'list'
            ? {
                targetType: ShareLinkTargetType.ListJoin,
                listId: 'list-1',
                name: 'Groceries',
              }
            : {
                targetType: ShareLinkTargetType.HomeJoin,
                homeId: target.homeId,
                name: target.name,
                memberCount: 2,
              },
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
    expect(result.current.joiningByCode).toBe(false);
    expect(result.current.loadingPreview).toBe(false);
    expect(result.current.previewHome).toBeNull();
  });

  describe('inviteUserToHome', () => {
    // A mock matches only its own variables, so an invite that resolves to no
    // refusal is one sent with exactly those.
    it('sends the trimmed email with the default role', async () => {
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

      let refusal: string | null | undefined;
      await act(async () => {
        refusal = await result.current.inviteUserToHome(
          'home-1',
          '  user@test.com  ',
        );
      });

      expect(refusal).toBeNull();
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

      let refusal: string | null | undefined;
      await act(async () => {
        refusal = await result.current.inviteUserToHome(
          'home-1',
          'admin@test.com',
          MembershipRole.Admin,
        );
      });

      expect(refusal).toBeNull();
    });

    it('hands a refusal back as localized copy for the modal to show inline', async () => {
      const rejectionMock: MockFor<typeof InviteToHomeDocument> = {
        request: {
          query: InviteToHomeDocument,
          variables: {
            input: {
              homeId: 'home-1',
              email: 'dupe@test.com',
              role: MembershipRole.Member,
            },
          },
        },
        result: {
          data: {
            inviteToHome: {
              __typename: 'ConflictError',
              code: ErrorCode.ResourceAlreadyExists,
              message: 'User already invited',
            },
          },
        },
      };

      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        { operationMocks: [rejectionMock] },
      );

      let refusal: string | null | undefined;
      await act(async () => {
        refusal = await result.current.inviteUserToHome(
          'home-1',
          'dupe@test.com',
        );
      });

      // Copy for the modal, which keeps itself open; never the server's prose,
      // and no native alert over the modal.
      expect(refusal).toBe('Failed to send invitation');
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    // Only someone who manages the home brings a removed member back; the
    // inviter is told about the invitee, not that they themselves were removed.
    const inviteeRefusals: Array<{ code: ErrorCode; copyKey: TranslationKey }> =
      [
        {
          code: ErrorCode.HomeMembershipRemoved,
          copyKey: 'inviteUser.inviteeRemoved',
        },
        {
          code: ErrorCode.HomeMembershipSuspended,
          copyKey: 'inviteUser.inviteeSuspended',
        },
      ];
    it.each(inviteeRefusals)(
      'says a $code invitee cannot be invited by this inviter',
      async ({ code, copyKey }) => {
        const refusedMock: MockFor<typeof InviteToHomeDocument> = {
          request: {
            query: InviteToHomeDocument,
            variables: {
              input: {
                homeId: 'home-1',
                email: 'gone@test.com',
                role: MembershipRole.Member,
              },
            },
          },
          result: {
            data: {
              inviteToHome: {
                __typename: 'ForbiddenError',
                code,
                message: 'refused',
              },
            },
          },
        };
        const { result } = renderHookWithApollo(
          () => useHomeInvitations(createOptions()),
          { operationMocks: [refusedMock] },
        );

        let refusal: string | null | undefined;
        await act(async () => {
          refusal = await result.current.inviteUserToHome(
            'home-1',
            'gone@test.com',
          );
        });

        expect(refusal).toBe(t(copyKey));
      },
    );
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

    // A refusal resolves with no error, so the mutation's `onError` never ran
    // and the join failed with nothing said.
    it('says once why a refused code did not join, in the app’s own words', async () => {
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
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(alertService.alert).not.toHaveBeenCalledWith(
        expect.anything(),
        'Home not found for join code',
      );
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
            buildShareLinkMock('XYZ789', {
              homeId: 'home-1',
              name: 'Test Home',
            }),
          ],
        },
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('  XYZ789  ');
      });

      expect(returnValue?.homeId).toBe('home-1');
      expect(returnValue?.name).toBe('Test Home');
      expect(returnValue?.memberCount).toBe(2);
    });

    it('returns null when query returns no home', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [buildShareLinkMock('INVALID', null)],
        },
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('INVALID');
      });

      expect(returnValue).toBeNull();
    });

    it("previews no home for a list's share code", async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        { operationMocks: [buildShareLinkMock('LIST42', 'list')] },
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('LIST42');
      });

      expect(returnValue).toBeNull();
    });

    // `errorPolicy: 'all'` resolves a failed lookup with `error` set and no
    // data rather than rejecting — that is the outcome the app actually gets.
    it('returns null when the lookup fails', async () => {
      const { result } = renderHookWithApollo(
        () => useHomeInvitations(createOptions()),
        {
          operationMocks: [
            {
              request: {
                query: ResolveShareLinkDocument,
                variables: { code: 'ABC123' },
              },
              error: new Error('network down'),
            },
          ],
        },
      );

      let returnValue: PreviewResult | undefined;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('ABC123');
      });

      expect(returnValue).toBeNull();
    });
  });
});

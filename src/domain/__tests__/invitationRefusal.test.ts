import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { AcceptHomeInviteDocument } from '#operations/home/home.generated';
import { errorService } from '#/services/errorService';
import { invitationRefusalCopy } from '../invitationRefusal';

const UNAVAILABLE = {
  title: 'Error',
  body: 'This invitation is no longer available. It may have been used, declined, or expired.',
};
const FALLBACK = 'Failed to accept invitation. Please try again.';

/** What the reader is told when an accept settles as `result`. */
const toldAfter = async (result: { data?: unknown; error?: unknown }) => {
  const settled = await settleMutation(() => Promise.resolve(result), {
    document: AcceptHomeInviteDocument,
    fallback: FALLBACK,
    copy: invitationRefusalCopy(),
    present: 'none',
  });
  return settled.failure?.body;
};

describe('invitationRefusalCopy', () => {
  it('tells a refused token the invitation was not found or has expired', () => {
    expect(invitationRefusalCopy()?.[ErrorCode.ValidationFailed]).toEqual({
      title: 'Error',
      body: 'Invitation not found or expired',
    });
  });

  it.each([ErrorCode.Conflict, ErrorCode.NotFound])(
    'tells %s the invitation is unavailable',
    code => {
      expect(invitationRefusalCopy()?.[code]).toEqual(UNAVAILABLE);
    },
  );

  it('names the account mismatch for FORBIDDEN', () => {
    expect(invitationRefusalCopy()?.[ErrorCode.Forbidden]).toEqual({
      title: 'Signed in as a different account',
      body: 'This invitation was sent to someone else. Sign in with the invited account to accept it.',
    });
  });

  describe('a code it writes no copy for', () => {
    let reportError: jest.SpyInstance;
    beforeEach(() => {
      reportError = jest
        .spyOn(errorService, 'reportError')
        .mockImplementation(() => undefined);
    });
    afterEach(() => reportError.mockRestore());

    it.each([ErrorCode.HomeMemberLimitReached, ErrorCode.AuthEmailNotVerified])(
      'has no entry for %s',
      code => {
        expect(invitationRefusalCopy()?.[code]).toBeUndefined();
      },
    );

    // A full home answers as a ConflictError member, told apart from a spent
    // invite by its code alone.
    it("says a full home is full, in that code's own sentence", async () => {
      expect(
        await toldAfter({
          data: {
            acceptHomeInvite: {
              __typename: 'ConflictError',
              code: ErrorCode.HomeMemberLimitReached,
            },
          },
        }),
      ).toBe('This home has reached its member limit');
    });

    it('asks an unverified account to verify, as the directive refuses it top-level', async () => {
      expect(
        await toldAfter({
          data: undefined,
          error: new CombinedGraphQLErrors({
            errors: [
              {
                message: 'Email not verified',
                extensions: { code: TopLevelErrorCode.AuthEmailNotVerified },
              },
            ],
          }),
        }),
      ).toBe('Please verify your email before continuing');
    });
  });
});

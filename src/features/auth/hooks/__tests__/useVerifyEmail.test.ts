import { waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
} from '#operations/auth/auth.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useVerifyEmail } from '../useVerifyEmail';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const verifyMock = () =>
  recordMock(VerifyEmailDocument, {
    data: {
      verifyEmail: {
        __typename: 'VerifyEmailPayload',
        user: { __typename: 'User', id: 'u1' },
      },
    },
  });

const resendMock = () =>
  recordMock(ResendVerificationEmailDocument, {
    data: {
      resendVerificationEmail: {
        __typename: 'ResendVerificationEmailPayload',
        user: { __typename: 'User', id: 'u1' },
      },
    },
  });

describe('useVerifyEmail', () => {
  it('sends the address alongside a 6-digit code', async () => {
    // The server matches a code against ONE account's pending verification,
    // so a code with no address is refused outright.
    const verify = verifyMock();
    const { result } = renderHookWithApollo(() => useVerifyEmail(), {
      operationMocks: [verify.mock, resendMock().mock],
    });

    await result.current.verifyEmail('123456', 'ada@example.com');

    await waitFor(() =>
      expect(verify.fired).toContainEqual({
        input: { code: '123456', email: 'ada@example.com' },
      }),
    );
  });

  it('sends a link token without one', async () => {
    // The emailed link's token carries its own identity.
    const verify = verifyMock();
    const { result } = renderHookWithApollo(() => useVerifyEmail(), {
      operationMocks: [verify.mock, resendMock().mock],
    });

    await result.current.verifyEmail('a-long-opaque-link-token');

    await waitFor(() =>
      expect(verify.fired).toContainEqual({
        input: { code: 'a-long-opaque-link-token', email: undefined },
      }),
    );
  });

  it('names the account the code verified', async () => {
    // A link can belong to another account than the one signed in here.
    const verify = recordMock(VerifyEmailDocument, {
      data: {
        verifyEmail: {
          __typename: 'VerifyEmailPayload',
          user: { __typename: 'User', id: 'account-b' },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useVerifyEmail(), {
      operationMocks: [verify.mock, resendMock().mock],
    });

    const outcome = await result.current.verifyEmail('link-token');

    expect(outcome).toEqual({ status: 'verified', userId: 'account-b' });
  });

  it('names no account when the address was already verified', async () => {
    const verify = recordMock(VerifyEmailDocument, {
      data: {
        verifyEmail: {
          __typename: 'ConflictError',
          code: ErrorCode.EmailAlreadyVerified,
          message: 'Email already verified',
        },
      },
    });
    const { result } = renderHookWithApollo(() => useVerifyEmail(), {
      operationMocks: [verify.mock, resendMock().mock],
    });

    const outcome = await result.current.verifyEmail('link-token');

    expect(outcome).toEqual({ status: 'verified', userId: null });
  });
});

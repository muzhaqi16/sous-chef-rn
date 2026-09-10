import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { useCompleteOnboarding } from '../useCompleteOnboarding';

/**
 * Onboarding has to finish with no network: the flag is written to the cached
 * user before the mutation fires, and a QUEUED result keeps it.
 */

const USER_ID = 'user-1';

const ONBOARDED = gql`
  fragment _TestOnboarded on User {
    onBoarded
  }
`;

const seedUser = (onBoarded: boolean) =>
  seedCache([
    {
      data: { __typename: 'User', id: USER_ID, onBoarded },
      fragment: ONBOARDED,
      fragmentName: '_TestOnboarded',
    },
  ]);

const readOnBoarded = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ onBoarded: boolean }>({
    id: cache.identify({ __typename: 'User', id: USER_ID }),
    fragment: ONBOARDED,
    fragmentName: '_TestOnboarded',
  })?.onBoarded;

describe('completing onboarding', () => {
  it('flips the cached flag and queues the write', async () => {
    // Queued: the offline queue answers with a null payload.
    const complete = recordMock(CompleteOnboardingDocument, {
      data: { completeOnboarding: null },
    });
    const cache = seedUser(false);
    const { result } = renderHookWithApollo(
      () => useCompleteOnboarding(USER_ID),
      { cache, operationMocks: [complete.mock] },
    );

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(complete.fired).toHaveLength(1);
    // Queued is not refused, so the flag stands and the user reaches the app.
    expect(readOnBoarded(cache)).toBe(true);
  });

  it('puts the flag back when the server refuses', async () => {
    const cache = seedUser(false);
    const { result } = renderHookWithApollo(
      () => useCompleteOnboarding(USER_ID),
      {
        cache,
        operationMocks: [
          {
            request: {
              query: CompleteOnboardingDocument,
              variables: () => true,
            },
            result: {
              data: {
                completeOnboarding: {
                  __typename: 'ForbiddenError',
                  code: 'FORBIDDEN',
                  message: 'nope',
                },
              },
            },
          },
        ],
      },
    );

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(readOnBoarded(cache)).toBe(false);
  });

  it('still fires with no user id to write against', async () => {
    const complete = recordMock(CompleteOnboardingDocument, {
      data: { completeOnboarding: null },
    });
    const { result } = renderHookWithApollo(
      () => useCompleteOnboarding(undefined),
      { operationMocks: [complete.mock] },
    );

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(complete.fired).toHaveLength(1);
  });
});

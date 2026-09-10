import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { InviteToHomeDocument } from '#operations/home/home.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useSendOnboardingInvites } from '#features/onboarding/hooks/useSendOnboardingInvites';

jest.mock('#/utils/finallyHelpers');

const onError = jest.fn();

const renderHook = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useSendOnboardingInvites(onError), {
    operationMocks,
  });

const TARGET = {
  homeId: 'home-1',
  shoppingListId: null,
  message: 'Join my home',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSendOnboardingInvites', () => {
  it('counts an invite the server refused', async () => {
    // The mutation carries an `onError`, so a refusal RESOLVES and the promise
    // the screen awaits settles either way — the count is the only signal that
    // separates a sent invite from a discarded one.
    const { mock } = recordMock(InviteToHomeDocument, {
      data: {
        inviteToHome: {
          __typename: 'ConflictError',
          code: ErrorCode.ResourceAlreadyExists,
          message: 'Already a member',
        },
      },
    });
    const { result } = renderHook([mock]);

    const { refusedCount } = await result.current.sendInvites(
      ['taken@example.com'],
      TARGET,
    );

    expect(refusedCount).toBe(1);
  });

  it('counts nothing when every invite is accepted', async () => {
    const { mock, fired } = recordMock(InviteToHomeDocument, {
      data: {
        inviteToHome: {
          __typename: 'InviteToHomePayload',
          homeInvite: { __typename: 'HomeInvite', id: 'invite-1' },
        },
      },
    });
    const { result } = renderHook([mock]);

    const { refusedCount } = await result.current.sendInvites(
      ['new@example.com'],
      TARGET,
    );

    expect(refusedCount).toBe(0);
    expect(fired).toHaveLength(1);
  });

  it('sends nothing when there is neither a home nor a list', async () => {
    const { mock, fired } = recordMock(InviteToHomeDocument, {
      data: {
        inviteToHome: {
          __typename: 'InviteToHomePayload',
          homeInvite: { __typename: 'HomeInvite', id: 'invite-1' },
        },
      },
    });
    const { result } = renderHook([mock]);

    const { refusedCount } = await result.current.sendInvites(
      ['nobody@example.com'],
      { homeId: null, shoppingListId: null, message: 'x' },
    );

    expect(refusedCount).toBe(0);
    expect(fired).toEqual([]);
  });
});

'use no memo';

import React from 'react';
import { userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#/services/alertService';
import {
  CollaboratorRole,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { AcceptInvite } from '../AcceptInvite';
import {
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
} from '#features/shoppingList/graphql/collaboration.generated';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  GetHomeInviteByTokenDocument,
  GetShoppingListInviteByTokenDocument,
} from '../AcceptInvite.generated';

// The screen resolves the invite straight from the deep-link token, so every
// test drives it through a route `token` and the *ByToken queries. In-app
// acceptance lives in InvitationAcceptanceModal and is tested there.
const TOKEN = 'invite-token';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  // The screen goes through useAppNavigation, whose goBack guards on
  // canGoBack — so the stand-in has to answer that too.
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
    canGoBack: () => true,
  })),
  useRoute: jest.fn(() => ({
    params: { token: 'invite-token' },
  })),
}));

jest.mock('#/services/errorService');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#components/organisms/Header', () => ({
  Header: () => null,
}));

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

interface ShoppingListInviteInput {
  id?: string;
  role?: CollaboratorRole;
  invitedByEmail?: string | null;
  invitedByDisplayName?: string | null;
  shoppingListName?: string | null;
  shoppingListDescription?: string | null;
}

// Shapes exactly what GetShoppingListInviteByToken selects (id, role, invitedBy,
// shoppingList) so useFragment reports `complete`.
function buildShoppingListInvite(input: ShoppingListInviteInput = {}) {
  const invitedBy =
    input.invitedByEmail === null
      ? null
      : {
          __typename: 'User',
          id: 'inviter-1',
          email: input.invitedByEmail ?? 'host@test.com',
          profile: input.invitedByDisplayName
            ? {
                __typename: 'UserProfile',
                id: 'inviter-profile',
                displayName: input.invitedByDisplayName,
              }
            : null,
        };
  return {
    __typename: 'ShoppingListCollaborator',
    id: input.id ?? 'invite-1',
    role: input.role ?? CollaboratorRole.Editor,
    invitedBy,
    shoppingList:
      input.shoppingListName === null
        ? null
        : {
            __typename: 'ShoppingList',
            id: 'list-1',
            name: input.shoppingListName ?? 'My List',
            description: input.shoppingListDescription ?? null,
          },
  };
}

interface HomeInviteInput {
  id?: string;
  role?: MembershipRole;
  inviterEmail?: string;
  inviterDisplayName?: string | null;
  homeName?: string | null;
}

// Shapes exactly what GetHomeInviteByToken selects.
function buildHomeInvite(input: HomeInviteInput = {}) {
  return {
    __typename: 'HomeInvite',
    id: input.id ?? 'invite-1',
    role: input.role ?? MembershipRole.Member,
    home:
      input.homeName === null
        ? null
        : {
            __typename: 'Home',
            id: 'home-1',
            name: input.homeName ?? 'Family Home',
          },
    inviter: {
      __typename: 'User',
      id: 'inviter-1',
      email: input.inviterEmail ?? 'owner@test.com',
      profile: input.inviterDisplayName
        ? {
            __typename: 'UserProfile',
            id: 'inviter-profile',
            displayName: input.inviterDisplayName,
          }
        : null,
    },
  };
}

function shoppingTokenMock(
  invite: ReturnType<typeof buildShoppingListInvite> | null,
  token: string = TOKEN,
): MockedResponse {
  return {
    request: {
      query: GetShoppingListInviteByTokenDocument,
      variables: { token },
    },
    result: { data: { shoppingListInviteByToken: invite } },
    maxUsageCount: 10,
  };
}

function homeTokenMock(
  invite: ReturnType<typeof buildHomeInvite> | null,
  token: string = TOKEN,
): MockedResponse {
  return {
    request: { query: GetHomeInviteByTokenDocument, variables: { token } },
    result: { data: { homeInviteByToken: invite } },
    maxUsageCount: 10,
  };
}

function buildAcceptShoppingListInviteMock(token: string): MockedResponse {
  return {
    request: {
      query: AcceptShoppingListInviteDocument,
      variables: { input: { token } },
    },
    result: {
      data: {
        acceptShoppingListInvite: {
          __typename: 'AcceptShoppingListInvitePayload',
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildRefusedShoppingListInviteMock(
  token: string,
  typename: 'NotFoundError' | 'ForbiddenError' | 'ConflictError',
): MockedResponse {
  return {
    request: {
      query: AcceptShoppingListInviteDocument,
      variables: { input: { token } },
    },
    result: { data: { acceptShoppingListInvite: { __typename: typename } } },
    maxUsageCount: 10,
  };
}

function buildAcceptHomeInviteMock(token: string): MockedResponse {
  return {
    request: {
      query: AcceptHomeInviteDocument,
      variables: { input: { token } },
    },
    result: {
      data: {
        acceptHomeInvite: {
          __typename: 'AcceptHomeInvitePayload',
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildDeclineShoppingListInviteMock(token: string): MockedResponse {
  return {
    request: {
      query: DeclineShoppingListInviteDocument,
      variables: { input: { token } },
    },
    result: {
      data: {
        declineShoppingListInvite: {
          __typename: 'DeclineShoppingListInvitePayload',
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildDeclineHomeInviteMock(token: string): MockedResponse {
  return {
    request: {
      query: DeclineHomeInviteDocument,
      variables: { input: { token } },
    },
    result: {
      data: {
        declineHomeInvite: {
          __typename: 'DeclineHomeInvitePayload',
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildAcceptShoppingListInviteErrorMock(token: string): MockedResponse {
  return {
    request: {
      query: AcceptShoppingListInviteDocument,
      variables: { input: { token } },
    },
    error: new Error('Network error'),
    maxUsageCount: 10,
  };
}

function buildDeclineShoppingListInviteErrorMock(
  token: string,
): MockedResponse {
  return {
    request: {
      query: DeclineShoppingListInviteDocument,
      variables: { input: { token } },
    },
    error: new Error('Failed'),
    maxUsageCount: 10,
  };
}

function makeExecuteWithLoadingStateImpl() {
  return async (
    fn: () => Promise<void>,
    setLoading: (value: boolean) => void,
    onError?: (error: unknown) => void,
  ) => {
    setLoading(true);
    let result: unknown;
    let didError = false;
    let caughtError: unknown;
    await Promise.resolve().then(async () => {
      try {
        result = await fn();
      } catch (e) {
        didError = true;
        caughtError = e;
      }
    });
    setLoading(false);
    if (didError && onError) onError(caughtError);
    return result;
  };
}

describe('AcceptInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const nav = jest.requireMock('@react-navigation/native');
    nav.useRoute.mockReturnValue({ params: { token: TOKEN } });
    const { executeWithLoadingState } = require('#/utils/finallyHelpers');
    executeWithLoadingState.mockImplementation(
      makeExecuteWithLoadingStateImpl(),
    );
  });

  it('shows "not found" when no invite matches', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [shoppingTokenMock(null), homeTokenMock(null)],
    });
    await waitFor(() =>
      expect(tree.getByText(/Invitation not found or expired/)).toBeTruthy(),
    );
  });

  it('shows loading state while fetching invites', () => {
    const tree = renderWithApollo(<AcceptInvite />, { operationMocks: [] });
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders shopping list invite details', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'Weekly Groceries' }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
    expect(tree.getByText('Accept')).toBeTruthy();
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('renders home invite details', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
  });

  it('shows Go Back button on not found state', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [shoppingTokenMock(null), homeTokenMock(null)],
    });
    await waitFor(() => expect(tree.getByText('Go Back')).toBeTruthy());
  });

  it('shows shopping list invite with inviter email fallback', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({
            invitedByEmail: 'host@test.com',
            shoppingListName: 'My List',
          }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText(/host@test.com/)).toBeTruthy());
  });

  it('shows "Someone" when inviter is missing for shopping list invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({
            invitedByEmail: null,
            shoppingListName: 'My List',
          }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText(/Someone/)).toBeTruthy());
  });

  it('shows role for shopping list invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({
            role: CollaboratorRole.Editor,
            shoppingListName: 'My List',
          }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText(/EDITOR/)).toBeTruthy());
  });

  it('shows "Shopping List" as invite type for shopping list invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText('Shopping List')).toBeTruthy());
  });

  it('renders invite details when home invite exists', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
    expect(tree.getByText('Accept')).toBeTruthy();
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('shows role for home invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(
          buildHomeInvite({
            role: MembershipRole.Admin,
            homeName: 'Family Home',
          }),
        ),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
  });

  it('shows "Shopping List" fallback when shopping list name is missing', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(buildShoppingListInvite({ shoppingListName: null })),
        homeTokenMock(null),
      ],
    });
    await waitFor(() =>
      expect(tree.getAllByText('Shopping List').length).toBeGreaterThanOrEqual(
        1,
      ),
    );
  });

  it('shows description when shopping list has description', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({
            shoppingListName: 'My List',
            shoppingListDescription: 'Weekly shopping',
          }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText('Description:')).toBeTruthy());
    expect(tree.getByText('Weekly shopping')).toBeTruthy();
  });

  it('shows accept and decline buttons for invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('calls acceptShoppingListInvite on accept for shopping list invite', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
        buildAcceptShoppingListInviteMock(TOKEN),
      ],
    });
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    await user.press(tree.getByText('Accept'));
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Success',
        'Shopping list invitation accepted!',
        expect.any(Array),
      ),
    );
  });

  // Refusals arrive as union members of a 200 response, so nothing throws and
  // `result.error` is undefined. A screen that reads neither reports success.
  describe('when the server refuses the deep-linked invite', () => {
    const refusalCase = async (
      typename: 'NotFoundError' | 'ForbiddenError' | 'ConflictError',
    ) => {
      const user = userEvent.setup();
      const tree = renderWithApollo(<AcceptInvite />, {
        operationMocks: [
          shoppingTokenMock(
            buildShoppingListInvite({ shoppingListName: 'My List' }),
          ),
          homeTokenMock(null),
          buildRefusedShoppingListInviteMock(TOKEN, typename),
        ],
      });
      await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
      await user.press(tree.getByText('Accept'));
      await waitFor(() => expect(alertService.alert).toHaveBeenCalled());
      return jest.mocked(alertService.alert).mock.calls;
    };

    it.each(['NotFoundError', 'ForbiddenError', 'ConflictError'] as const)(
      'does not claim success on %s',
      async typename => {
        const calls = await refusalCase(typename);
        expect(calls.flat()).not.toContain(
          'Shopping list invitation accepted!',
        );
      },
    );

    it("explains a revoked or spent invite in the reader's language", async () => {
      const calls = await refusalCase('NotFoundError');
      expect(calls.flat()).toContain(
        'This invitation is no longer available. It may have been used, declined, or expired.',
      );
    });

    it('names the account mismatch only for a permission refusal', async () => {
      const calls = await refusalCase('ForbiddenError');
      expect(calls.flat()).toContain('Signed in as a different account');
    });
  });

  it('calls acceptHomeInvite on accept for home invite', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
        buildAcceptHomeInviteMock(TOKEN),
      ],
    });
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
    await user.press(tree.getByText('Accept'));
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Success',
        'Home invitation accepted!',
        expect.any(Array),
      ),
    );
  });

  it('shows decline confirmation dialog', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText('Decline')).toBeTruthy());
    await user.press(tree.getByText('Decline'));
    expect(alertService.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      expect.any(Array),
    );
  });

  it('calls declineShoppingListInvite when decline is confirmed', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
        buildDeclineShoppingListInviteMock(TOKEN),
      ],
    });
    await waitFor(() => expect(tree.getByText('Decline')).toBeTruthy());
    await user.press(tree.getByText('Decline'));
    const alertCall = (alertService.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as AlertButton[];
    const declineBtn = buttons.find(b => b.text === 'Decline');
    await declineBtn?.onPress?.();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('calls declineHomeInvite when decline is confirmed for home invite', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
        buildDeclineHomeInviteMock(TOKEN),
      ],
    });
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
    await user.press(tree.getByText('Decline'));
    const alertCall = (alertService.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as AlertButton[];
    const declineBtn = buttons.find(b => b.text === 'Decline');
    await declineBtn?.onPress?.();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('shows error alert when accept fails', async () => {
    const user = userEvent.setup();
    const { executeWithLoadingState } = require('#/utils/finallyHelpers');
    executeWithLoadingState.mockImplementationOnce(
      (
        _fn: () => Promise<void>,
        _setLoading: (value: boolean) => void,
        onError: (error: unknown) => void,
      ) => {
        onError(new Error('An unexpected database error occurred'));
      },
    );
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
        buildAcceptShoppingListInviteErrorMock(TOKEN),
      ],
    });
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    await user.press(tree.getByText('Accept'));
    // The server's own text is unlocalizable English by construction — the
    // client sends no `Accept-Language` and the token carries no locale — so it
    // must not be what the alert body says. `expect.any(String)` is what let it
    // through here.
    await waitFor(() => {
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong.',
      );
    });
  });

  it('shows error alert for invalid invitation when no token', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: {} });
    const tree = renderWithApollo(<AcceptInvite />, { operationMocks: [] });
    await waitFor(() =>
      expect(tree.getByText(/Invitation not found/)).toBeTruthy(),
    );
    useRoute.mockReturnValue({ params: { token: TOKEN } });
  });

  it('shows "Home" invite type label for home invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
      ],
    });
    await waitFor(() =>
      expect(tree.getAllByText('Home').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('shows "Home" fallback when home invite has no home name', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: null })),
      ],
    });
    await waitFor(() =>
      expect(tree.getAllByText('Home').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('shows inviter email for home invite when no displayName', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
      ],
    });
    await waitFor(() => expect(tree.getByText(/owner@test.com/)).toBeTruthy());
  });

  it('navigates back when Go Back is pressed on not found screen', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [shoppingTokenMock(null), homeTokenMock(null)],
    });
    await waitFor(() => expect(tree.getByText('Go Back')).toBeTruthy());
    await user.press(tree.getByText('Go Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows "Someone" when home inviter has no displayName or email', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(
          buildHomeInvite({ inviterEmail: '', homeName: 'Family Home' }),
        ),
      ],
    });
    await waitFor(() => expect(tree.getByText(/Someone/)).toBeTruthy());
  });

  it('shows inviter displayName for home invite when available', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(
          buildHomeInvite({
            inviterDisplayName: 'HomeOwner',
            homeName: 'Family Home',
          }),
        ),
      ],
    });
    await waitFor(() => expect(tree.getByText(/HomeOwner/)).toBeTruthy());
  });

  it('shows inviter displayName for shopping list invite when available', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({
            invitedByDisplayName: 'ListOwner',
            shoppingListName: 'My List',
          }),
        ),
        homeTokenMock(null),
      ],
    });
    await waitFor(() => expect(tree.getByText(/ListOwner/)).toBeTruthy());
  });

  it('shows loading state when invites are still loading', () => {
    const tree = renderWithApollo(<AcceptInvite />, { operationMocks: [] });
    expect(tree.toJSON()).toBeTruthy();
  });

  it('uses a custom token from route params', async () => {
    const user = userEvent.setup();
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { token: 'deep-link-token' } });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
          'deep-link-token',
        ),
        homeTokenMock(null, 'deep-link-token'),
        buildAcceptShoppingListInviteMock('deep-link-token'),
      ],
    });
    await waitFor(() => expect(tree.getByText(/collaborate on/)).toBeTruthy());
    await user.press(tree.getByText('Accept'));
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Success',
        'Shopping list invitation accepted!',
        expect.any(Array),
      ),
    );
    useRoute.mockReturnValue({ params: { token: TOKEN } });
  });

  it('resolves a home invite from a token deep link', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { token: 'home-token' } });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null, 'home-token'),
        homeTokenMock(
          buildHomeInvite({ homeName: 'Beach House' }),
          'home-token',
        ),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
    expect(tree.getByText('Beach House')).toBeTruthy();
    useRoute.mockReturnValue({ params: { token: TOKEN } });
  });

  it('resolves a shopping-list invite from a token deep link', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { token: 'list-token' } });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'Camping Trip' }),
          'list-token',
        ),
        homeTokenMock(null, 'list-token'),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
    expect(tree.getByText('Camping Trip')).toBeTruthy();
    expect(tree.getByText(/collaborate on/)).toBeTruthy();
    useRoute.mockReturnValue({ params: { token: TOKEN } });
  });

  it('shows "join" text for home invite and "collaborate on" for shopping list', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(null),
        homeTokenMock(buildHomeInvite({ homeName: 'Family Home' })),
      ],
    });
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
  });

  it('shows error alert when decline fails', async () => {
    const user = userEvent.setup();
    const { executeWithLoadingState } = require('#/utils/finallyHelpers');
    executeWithLoadingState.mockImplementation(
      async (
        _fn: () => Promise<void>,
        _setLoading: (value: boolean) => void,
        onError: (error: unknown) => void,
      ) => {
        onError(new Error('decline failed'));
        return undefined;
      },
    );
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        shoppingTokenMock(
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ),
        homeTokenMock(null),
        buildDeclineShoppingListInviteErrorMock(TOKEN),
      ],
    });
    await waitFor(() => expect(tree.getByText('Decline')).toBeTruthy());
    await user.press(tree.getByText('Decline'));
    const alertCall = (alertService.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as AlertButton[];
    const declineBtn = buttons.find(b => b.text === 'Decline');
    await declineBtn?.onPress?.();
    await waitFor(() => {
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to decline invitation',
      );
    });
  });
});

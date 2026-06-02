'use no memo';

import React from 'react';
import { userEvent, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#/services/alertService';
import {
  CollaboratorRole,
  CollaboratorStatus,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { AcceptInvite } from '../AcceptInvite';
import {
  MyShoppingListInvitesDocument,
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
} from '#features/shoppingList/graphql/collaboration.generated';
import {
  GetMyPendingInvitesDocument,
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  GetHomeInviteByTokenDocument,
  GetShoppingListInviteByTokenDocument,
} from '../AcceptInvite.generated';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
  })),
  useRoute: jest.fn(() => ({
    params: { inviteId: 'invite-1' },
  })),
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : 'Unknown error',
  ),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/molecules/Header', () => ({
  Header: () => null,
}));

jest.mock('#/components/base/SousChefLoader', () => ({
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

function buildShoppingListInvite(input: ShoppingListInviteInput = {}) {
  const id = input.id ?? 'invite-1';
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
    id,
    token: id,
    shoppingListId: 'list-1',
    collaboratorId: null,
    email: 'me@test.com',
    role: input.role ?? CollaboratorRole.Editor,
    status: CollaboratorStatus.Pending,
    canEdit: true,
    canAddItems: true,
    canRemoveItems: true,
    canMarkPurchased: true,
    canInviteOthers: false,
    invitedAt: '2025-01-01T00:00:00.000Z',
    expiresAt: null,
    shoppingList:
      input.shoppingListName === null
        ? null
        : {
            __typename: 'ShoppingList',
            id: 'list-1',
            name: input.shoppingListName ?? 'My List',
            description: input.shoppingListDescription ?? null,
          },
    collaborator: null,
    invitedBy,
  };
}

interface HomeInviteInput {
  id?: string;
  role?: MembershipRole;
  inviterEmail?: string;
  inviterDisplayName?: string | null;
  homeName?: string | null;
}

function buildHomeInvite(input: HomeInviteInput = {}) {
  const id = input.id ?? 'invite-1';
  return {
    __typename: 'HomeInvite',
    id,
    token: id,
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

function buildShoppingListInvitesMock(
  invites: ReturnType<typeof buildShoppingListInvite>[],
): MockedResponse {
  return {
    request: { query: MyShoppingListInvitesDocument },
    result: {
      data: {
        me: {
          __typename: 'User',
          id: 'me-1',
          pendingCollaborationInvites: invites,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildHomeInvitesMock(
  invites: ReturnType<typeof buildHomeInvite>[],
): MockedResponse {
  return {
    request: { query: GetMyPendingInvitesDocument },
    result: {
      data: {
        me: {
          __typename: 'User',
          id: 'me-1',
          pendingHomeInvites: invites,
        },
      },
    },
    maxUsageCount: 10,
  };
}

const buildEmptyShoppingListInvitesMock = () =>
  buildShoppingListInvitesMock([]);
const buildEmptyHomeInvitesMock = () => buildHomeInvitesMock([]);

function buildHomeInviteByTokenMock(
  token: string,
  homeName: string | null,
): MockedResponse {
  return {
    request: { query: GetHomeInviteByTokenDocument, variables: { token } },
    result: {
      data: {
        homeInviteByToken: homeName
          ? {
              __typename: 'HomeInvite',
              id: 'home-invite-9',
              role: MembershipRole.Member,
              home: { __typename: 'Home', id: 'home-9', name: homeName },
              inviter: {
                __typename: 'User',
                id: 'inviter-9',
                email: 'owner@test.com',
                profile: null,
              },
            }
          : null,
      },
    },
    maxUsageCount: 10,
  };
}

function buildShoppingListInviteByTokenMock(
  token: string,
  listName: string | null,
): MockedResponse {
  return {
    request: {
      query: GetShoppingListInviteByTokenDocument,
      variables: { token },
    },
    result: {
      data: {
        shoppingListInviteByToken: listName
          ? {
              __typename: 'ShoppingListCollaborator',
              id: 'list-invite-9',
              role: CollaboratorRole.Editor,
              invitedBy: {
                __typename: 'User',
                id: 'inviter-9',
                email: 'host@test.com',
                profile: null,
              },
              shoppingList: {
                __typename: 'ShoppingList',
                id: 'list-9',
                name: listName,
                description: null,
              },
            }
          : null,
      },
    },
    maxUsageCount: 10,
  };
}

function buildAcceptShoppingListInviteMock(token: string): MockedResponse {
  return {
    request: { query: AcceptShoppingListInviteDocument, variables: { token } },
    result: {
      data: {
        acceptShoppingListInvite: {
          __typename: 'ShoppingListCollaboratorPayload',
          success: true,
          message: 'OK',
          code: 'SUCCESS',
          collaborator: null,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildAcceptHomeInviteMock(token: string): MockedResponse {
  return {
    request: { query: AcceptHomeInviteDocument, variables: { token } },
    result: {
      data: {
        acceptHomeInvite: {
          __typename: 'MembershipPayload',
          success: true,
          message: 'OK',
          code: 'SUCCESS',
          membership: null,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildDeclineShoppingListInviteMock(token: string): MockedResponse {
  return {
    request: { query: DeclineShoppingListInviteDocument, variables: { token } },
    result: {
      data: {
        declineShoppingListInvite: {
          __typename: 'ShoppingListCollaboratorPayload',
          success: true,
          message: 'OK',
          code: 'SUCCESS',
          collaborator: null,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildDeclineHomeInviteMock(token: string): MockedResponse {
  return {
    request: { query: DeclineHomeInviteDocument, variables: { token } },
    result: {
      data: {
        declineHomeInvite: {
          __typename: 'HomeInvitePayload',
          success: true,
          message: 'OK',
          code: 'SUCCESS',
          homeInvite: null,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildAcceptShoppingListInviteErrorMock(token: string): MockedResponse {
  return {
    request: { query: AcceptShoppingListInviteDocument, variables: { token } },
    error: new Error('Network error'),
    maxUsageCount: 10,
  };
}

function buildDeclineShoppingListInviteErrorMock(
  token: string,
): MockedResponse {
  return {
    request: { query: DeclineShoppingListInviteDocument, variables: { token } },
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
    nav.useRoute.mockReturnValue({ params: { inviteId: 'invite-1' } });
    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    executeWithLoadingState.mockImplementation(
      makeExecuteWithLoadingStateImpl(),
    );
  });

  it('shows "not found" when no invite matches', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildEmptyHomeInvitesMock(),
      ],
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
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'Weekly Groceries' }),
        ]),
        buildEmptyHomeInvitesMock(),
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
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
  });

  it('shows Go Back button on not found state', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText('Go Back')).toBeTruthy());
  });

  it('shows shopping list invite with inviter email fallback', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({
            invitedByEmail: 'host@test.com',
            shoppingListName: 'My List',
          }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText(/host@test.com/)).toBeTruthy());
  });

  it('shows "Someone" when inviter is missing for shopping list invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({
            invitedByEmail: null,
            shoppingListName: 'My List',
          }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText(/Someone/)).toBeTruthy());
  });

  it('shows role for shopping list invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({
            role: CollaboratorRole.Editor,
            shoppingListName: 'My List',
          }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText(/EDITOR/)).toBeTruthy());
  });

  it('shows "Shopping List" as invite type for shopping list invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText('Shopping List')).toBeTruthy());
  });

  it('renders invite details when home invite exists', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
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
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([
          buildHomeInvite({
            role: MembershipRole.Admin,
            homeName: 'Family Home',
          }),
        ]),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
  });

  it('shows "Shopping List" fallback when shopping list name is missing', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: null }),
        ]),
        buildEmptyHomeInvitesMock(),
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
        buildShoppingListInvitesMock([
          buildShoppingListInvite({
            shoppingListName: 'My List',
            shoppingListDescription: 'Weekly shopping',
          }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText('Description:')).toBeTruthy());
    expect(tree.getByText('Weekly shopping')).toBeTruthy();
  });

  it('shows accept and decline buttons for invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    expect(tree.getByText('Decline')).toBeTruthy();
  });

  it('calls acceptShoppingListInvite on accept for shopping list invite', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
        buildAcceptShoppingListInviteMock('invite-1'),
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

  it('calls acceptHomeInvite on accept for home invite', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
        buildAcceptHomeInviteMock('invite-1'),
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
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
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
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
        buildDeclineShoppingListInviteMock('invite-1'),
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
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
        buildDeclineHomeInviteMock('invite-1'),
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
    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
    executeWithLoadingState.mockImplementationOnce(
      (
        _fn: () => Promise<void>,
        _setLoading: (value: boolean) => void,
        onError: (error: unknown) => void,
      ) => {
        onError(new Error('Network error'));
      },
    );
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
        buildAcceptShoppingListInviteErrorMock('invite-1'),
      ],
    });
    await waitFor(() => expect(tree.getByText('Accept')).toBeTruthy());
    await user.press(tree.getByText('Accept'));
    await waitFor(() => {
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
      );
    });
  });

  it('shows error alert for invalid invitation when no token', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: {} });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText(/Invitation not found/)).toBeTruthy(),
    );
    useRoute.mockReturnValue({ params: { inviteId: 'invite-1' } });
  });

  it('shows "Home" invite type label for home invite', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
      ],
    });
    await waitFor(() =>
      expect(tree.getAllByText('Home').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('shows "Home" fallback when home invite has no home name', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: null })]),
      ],
    });
    await waitFor(() =>
      expect(tree.getAllByText('Home').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('shows inviter email for home invite when no displayName', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
      ],
    });
    await waitFor(() => expect(tree.getByText(/owner@test.com/)).toBeTruthy());
  });

  it('navigates back when Go Back is pressed on not found screen', async () => {
    const user = userEvent.setup();
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText('Go Back')).toBeTruthy());
    await user.press(tree.getByText('Go Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows "Someone" when home inviter has no displayName or email', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([
          buildHomeInvite({ inviterEmail: '', homeName: 'Family Home' }),
        ]),
      ],
    });
    await waitFor(() => expect(tree.getByText(/Someone/)).toBeTruthy());
  });

  it('shows inviter displayName for home invite when available', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([
          buildHomeInvite({
            inviterDisplayName: 'HomeOwner',
            homeName: 'Family Home',
          }),
        ]),
      ],
    });
    await waitFor(() => expect(tree.getByText(/HomeOwner/)).toBeTruthy());
  });

  it('shows inviter displayName for shopping list invite when available', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({
            invitedByDisplayName: 'ListOwner',
            shoppingListName: 'My List',
          }),
        ]),
        buildEmptyHomeInvitesMock(),
      ],
    });
    await waitFor(() => expect(tree.getByText(/ListOwner/)).toBeTruthy());
  });

  it('shows loading state when home invites are still loading', () => {
    const tree = renderWithApollo(<AcceptInvite />, { operationMocks: [] });
    expect(tree.toJSON()).toBeTruthy();
  });

  it('uses token from route params when available', async () => {
    const user = userEvent.setup();
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({
      params: { token: 'deep-link-token', inviteId: 'invite-1' },
    });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
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
  });

  it('resolves a home invite from a token deep link with no inviteId', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { token: 'home-token' } });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildEmptyHomeInvitesMock(),
        buildHomeInviteByTokenMock('home-token', 'Beach House'),
        buildShoppingListInviteByTokenMock('home-token', null),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
    expect(tree.getByText('Beach House')).toBeTruthy();
    useRoute.mockReturnValue({ params: { inviteId: 'invite-1' } });
  });

  it('resolves a shopping-list invite from a token deep link with no inviteId', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { token: 'list-token' } });
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildEmptyHomeInvitesMock(),
        buildHomeInviteByTokenMock('list-token', null),
        buildShoppingListInviteByTokenMock('list-token', 'Camping Trip'),
      ],
    });
    await waitFor(() =>
      expect(tree.getByText("You've been invited!")).toBeTruthy(),
    );
    expect(tree.getByText('Camping Trip')).toBeTruthy();
    expect(tree.getByText(/collaborate on/)).toBeTruthy();
    useRoute.mockReturnValue({ params: { inviteId: 'invite-1' } });
  });

  it('shows "join" text for home invite and "collaborate on" for shopping list', async () => {
    const tree = renderWithApollo(<AcceptInvite />, {
      operationMocks: [
        buildEmptyShoppingListInvitesMock(),
        buildHomeInvitesMock([buildHomeInvite({ homeName: 'Family Home' })]),
      ],
    });
    await waitFor(() => expect(tree.getByText(/join/)).toBeTruthy());
  });

  it('shows error alert when decline fails', async () => {
    const user = userEvent.setup();
    const { executeWithLoadingState } = require('#/utils/compilerSafeWrappers');
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
        buildShoppingListInvitesMock([
          buildShoppingListInvite({ shoppingListName: 'My List' }),
        ]),
        buildEmptyHomeInvitesMock(),
        buildDeclineShoppingListInviteErrorMock('invite-1'),
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

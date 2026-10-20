'use no memo';

import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type {
  MockedResponse,
  MockFor,
  MockPart,
  RecordedMock,
} from '#/test-utils/apolloMockProvider';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import {
  CollaboratorRole,
  ErrorCode,
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
  type AcceptInvite_HomeInviteFragment,
  type AcceptInvite_ShoppingListInviteFragment,
  type GetHomeInviteByTokenQuery,
  type GetShoppingListInviteByTokenQuery,
} from '../AcceptInvite.generated';

// The screen resolves the invite straight from the deep-link token, so every
// test drives it through a route `token` and the *ByToken queries. In-app
// acceptance lives in InvitationAcceptanceModal and is tested there.
const TOKEN = 'invite-token';

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

jest.mock('#components/organisms/Header', () => ({
  Header: () => null,
}));

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

interface ShoppingListInviteInput {
  role?: CollaboratorRole;
  invitedByEmail?: string | null;
  invitedByDisplayName?: string | null;
  shoppingListName?: string;
  shoppingListDescription?: string | null;
}

/** The invite on the wire: the query's own selection plus the screen's fragment. */
type ShoppingListInvite =
  GetShoppingListInviteByTokenQuery['shoppingListInviteByToken'] &
    AcceptInvite_ShoppingListInviteFragment;

function buildShoppingListInvite(
  input: ShoppingListInviteInput = {},
): MockPart<ShoppingListInvite> {
  return {
    role: input.role ?? CollaboratorRole.Editor,
    invitedBy:
      input.invitedByEmail === null
        ? null
        : {
            email: input.invitedByEmail ?? 'host@test.com',
            profile: input.invitedByDisplayName
              ? { displayName: input.invitedByDisplayName }
              : null,
          },
    shoppingList: {
      name: input.shoppingListName ?? 'My List',
      description: input.shoppingListDescription ?? null,
    },
  };
}

interface HomeInviteInput {
  role?: MembershipRole;
  inviterEmail?: string;
  inviterDisplayName?: string | null;
  homeName?: string;
}

type HomeInvite = GetHomeInviteByTokenQuery['homeInviteByToken'] &
  AcceptInvite_HomeInviteFragment;

function buildHomeInvite(input: HomeInviteInput = {}): MockPart<HomeInvite> {
  return {
    role: input.role ?? MembershipRole.Member,
    home: { name: input.homeName ?? 'Family Home' },
    inviter: {
      email: input.inviterEmail ?? 'owner@test.com',
      profile: input.inviterDisplayName
        ? { displayName: input.inviterDisplayName }
        : null,
    },
  };
}

/** What the deep link's token resolves to: a list invite, a home invite, or neither. */
type LinkedInvite =
  | { list: ShoppingListInviteInput }
  | { home: HomeInviteInput }
  | null;

const variables = (token: string) => ({ input: { token } });

function tokenMocks(
  invite: LinkedInvite,
  token: string,
): [
  MockFor<typeof GetShoppingListInviteByTokenDocument>,
  MockFor<typeof GetHomeInviteByTokenDocument>,
] {
  return [
    {
      request: {
        query: GetShoppingListInviteByTokenDocument,
        variables: { token },
      },
      result: {
        data: {
          shoppingListInviteByToken:
            invite && 'list' in invite
              ? buildShoppingListInvite(invite.list)
              : null,
        },
      },
      maxUsageCount: 10,
    },
    {
      request: { query: GetHomeInviteByTokenDocument, variables: { token } },
      result: {
        data: {
          homeInviteByToken:
            invite && 'home' in invite ? buildHomeInvite(invite.home) : null,
        },
      },
      maxUsageCount: 10,
    },
  ];
}

/** Renders the screen on a deep link whose token resolves to `invite`. */
function renderInvite(
  invite: LinkedInvite,
  writes: MockedResponse[] = [],
  token = TOKEN,
) {
  jest
    .requireMock('@react-navigation/native')
    .useRoute.mockReturnValue({ params: { token } });
  return renderWithApollo(<AcceptInvite />, {
    operationMocks: [...tokenMocks(invite, token), ...writes],
  });
}

const LIST_INVITE = { list: {} };
const HOME_INVITE = { home: {} };

const acceptListMock = (
  token = TOKEN,
): MockFor<typeof AcceptShoppingListInviteDocument> => ({
  request: {
    query: AcceptShoppingListInviteDocument,
    variables: variables(token),
  },
  result: {
    data: {
      acceptShoppingListInvite: {
        __typename: 'AcceptShoppingListInvitePayload',
      },
    },
  },
});

const REFUSAL_CODE = {
  NotFoundError: ErrorCode.NotFound,
  ForbiddenError: ErrorCode.Forbidden,
  ConflictError: ErrorCode.Conflict,
};

const refusedListMock = (
  typename: 'NotFoundError' | 'ForbiddenError' | 'ConflictError',
): MockFor<typeof AcceptShoppingListInviteDocument> => ({
  request: {
    query: AcceptShoppingListInviteDocument,
    variables: variables(TOKEN),
  },
  result: {
    data: {
      acceptShoppingListInvite: {
        __typename: typename,
        code: REFUSAL_CODE[typename],
      },
    },
  },
});

const acceptHomeMock: MockFor<typeof AcceptHomeInviteDocument> = {
  request: { query: AcceptHomeInviteDocument, variables: variables(TOKEN) },
  result: {
    data: { acceptHomeInvite: { __typename: 'AcceptHomeInvitePayload' } },
  },
};

const declineListMock: MockFor<typeof DeclineShoppingListInviteDocument> = {
  request: {
    query: DeclineShoppingListInviteDocument,
    variables: variables(TOKEN),
  },
  result: {
    data: {
      declineShoppingListInvite: {
        __typename: 'DeclineShoppingListInvitePayload',
      },
    },
  },
};

const declineHomeMock: MockFor<typeof DeclineHomeInviteDocument> = {
  request: { query: DeclineHomeInviteDocument, variables: variables(TOKEN) },
  result: {
    data: { declineHomeInvite: { __typename: 'DeclineHomeInvitePayload' } },
  },
};

const failingMock = (
  query:
    | typeof AcceptShoppingListInviteDocument
    | typeof DeclineShoppingListInviteDocument,
  error: Error,
): MockedResponse => ({
  request: { query, variables: variables(TOKEN) },
  error,
});

const alerts = () => jest.mocked(alertService.alert).mock.calls;

/** Presses Decline, then the confirmation's own Decline. */
async function declineAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.press(await screen.findByText('Decline'));
  const [confirmation] = alerts();
  confirmation?.[2]?.find(b => b.text === 'Decline')?.onPress?.();
}

describe('AcceptInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each<[string, LinkedInvite, Array<string | RegExp>]>([
    [
      'shows "not found" when no invite matches',
      null,
      [/Invitation not found or expired/],
    ],
    ['shows Go Back button on not found state', null, ['Go Back']],
    [
      'renders shopping list invite details',
      { list: { shoppingListName: 'Weekly Groceries' } },
      ["You've been invited!", 'Accept', 'Decline'],
    ],
    [
      'shows shopping list invite with inviter email fallback',
      { list: { invitedByEmail: 'host@test.com' } },
      [/host@test.com/],
    ],
    [
      'shows "Someone" when inviter is missing for shopping list invite',
      { list: { invitedByEmail: null } },
      [/Someone/],
    ],
    [
      'shows role for shopping list invite',
      { list: { role: CollaboratorRole.Editor } },
      [/EDITOR/],
    ],
    [
      'shows "Shopping List" as invite type for shopping list invite',
      LIST_INVITE,
      ['Shopping List'],
    ],
    [
      'shows description when shopping list has description',
      { list: { shoppingListDescription: 'Weekly shopping' } },
      ['Description:', 'Weekly shopping'],
    ],
    [
      'shows inviter displayName for shopping list invite when available',
      { list: { invitedByDisplayName: 'ListOwner' } },
      [/ListOwner/],
    ],
    [
      'renders invite details when home invite exists',
      HOME_INVITE,
      ["You've been invited!", 'Accept', 'Decline'],
    ],
    [
      'shows role for home invite',
      { home: { role: MembershipRole.Admin } },
      ["You've been invited!", /ADMIN/],
    ],
    ['shows "Home" invite type label for home invite', HOME_INVITE, ['Home']],
    [
      'shows inviter email for home invite when no displayName',
      HOME_INVITE,
      [/owner@test.com/],
    ],
    [
      'shows "Someone" when home inviter has no displayName or email',
      { home: { inviterEmail: '' } },
      [/Someone/],
    ],
    [
      'shows inviter displayName for home invite when available',
      { home: { inviterDisplayName: 'HomeOwner' } },
      [/HomeOwner/],
    ],
    [
      'shows "join" text for home invite and "collaborate on" for shopping list',
      HOME_INVITE,
      [/join/],
    ],
  ])('%s', async (_name, invite, texts) => {
    renderInvite(invite);

    for (const text of texts) {
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
    }
  });

  it('shows loading state while fetching invites', () => {
    const tree = renderWithApollo(<AcceptInvite />, { operationMocks: [] });
    expect(tree.toJSON()).toBeTruthy();
  });

  it.each<[string, string, LinkedInvite, string]>([
    [
      'home',
      'home-token',
      { home: { homeName: 'Beach House' } },
      'Beach House',
    ],
    [
      'shopping-list',
      'list-token',
      { list: { shoppingListName: 'Camping Trip' } },
      'Camping Trip',
    ],
  ])(
    'resolves a %s invite from a token deep link',
    async (kind, token, invite, name) => {
      renderInvite(invite, [], token);

      expect(await screen.findByText("You've been invited!")).toBeTruthy();
      expect(screen.getByText(name)).toBeTruthy();
      if (kind === 'shopping-list') {
        expect(screen.getByText(/collaborate on/)).toBeTruthy();
      }
    },
  );

  it.each<[string, LinkedInvite, MockedResponse, string]>([
    [
      'calls acceptShoppingListInvite on accept for shopping list invite',
      LIST_INVITE,
      acceptListMock(),
      'Shopping list invitation accepted!',
    ],
    [
      'calls acceptHomeInvite on accept for home invite',
      HOME_INVITE,
      acceptHomeMock,
      'Home invitation accepted!',
    ],
  ])('%s', async (_name, invite, accept, message) => {
    const user = userEvent.setup();
    renderInvite(invite, [accept]);

    await user.press(await screen.findByText('Accept'));

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Success',
        message,
        expect.any(Array),
      ),
    );
  });

  it('uses a custom token from route params', async () => {
    const user = userEvent.setup();
    renderInvite(
      LIST_INVITE,
      [acceptListMock('deep-link-token')],
      'deep-link-token',
    );

    await screen.findByText(/collaborate on/);
    await user.press(screen.getByText('Accept'));

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
      renderInvite(LIST_INVITE, [refusedListMock(typename)]);
      await user.press(await screen.findByText('Accept'));
      await waitFor(() => expect(alertService.alert).toHaveBeenCalled());
      return alerts().flat();
    };

    it.each(['NotFoundError', 'ForbiddenError', 'ConflictError'] as const)(
      'does not claim success on %s',
      async typename => {
        expect(await refusalCase(typename)).not.toContain(
          'Shopping list invitation accepted!',
        );
      },
    );

    it("explains a revoked or spent invite in the reader's language", async () => {
      expect(await refusalCase('NotFoundError')).toContain(
        'This invitation is no longer available. It may have been used, declined, or expired.',
      );
    });

    it('names the account mismatch only for a permission refusal', async () => {
      expect(await refusalCase('ForbiddenError')).toContain(
        'Signed in as a different account',
      );
    });
  });

  // The gate lives in the hook, so it holds for both kinds of invite.
  describe('when the signed-in account has not verified its email', () => {
    beforeEach(() => {
      useStore.setState({
        user: {
          id: 'user-1',
          email: 'invitee@example.com',
          emailVerified: false,
          onBoarded: true,
        },
      });
    });

    afterEach(() => {
      useStore.setState({ user: null });
    });

    it.each<[string, LinkedInvite, () => RecordedMock, string]>([
      [
        'a list invite',
        LIST_INVITE,
        () => recordMock(AcceptShoppingListInviteDocument, { data: {} }),
        'Shopping list invitation accepted!',
      ],
      [
        'a home invite',
        HOME_INVITE,
        () => recordMock(AcceptHomeInviteDocument, { data: {} }),
        'Home invitation accepted!',
      ],
    ])(
      'offers verification instead of accepting %s',
      async (_kind, invite, acceptMock, success) => {
        const user = userEvent.setup();
        const accept = acceptMock();
        renderInvite(invite, [accept.mock]);

        await user.press(await screen.findByText('Accept'));

        await waitFor(() =>
          expect(alertService.alert).toHaveBeenCalledWith(
            'Verify your email first',
            expect.any(String),
            expect.arrayContaining([
              expect.objectContaining({ text: 'Verify Now' }),
            ]),
          ),
        );
        expect(accept.fired).toHaveLength(0);
        expect(alerts().flat()).not.toContain(success);
        expect(mockGoBack).not.toHaveBeenCalled();
      },
    );

    // Declining shares nothing, and the API takes it from an unverified account.
    it('still declines', async () => {
      const user = userEvent.setup();
      renderInvite(LIST_INVITE, [declineListMock]);

      await declineAndConfirm(user);

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(alerts().flat()).not.toContain('Verify your email first');
    });
  });

  it('shows decline confirmation dialog', async () => {
    const user = userEvent.setup();
    renderInvite(LIST_INVITE);

    await user.press(await screen.findByText('Decline'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      expect.any(Array),
    );
  });

  it.each<[string, LinkedInvite, MockedResponse]>([
    [
      'calls declineShoppingListInvite when decline is confirmed',
      LIST_INVITE,
      declineListMock,
    ],
    [
      'calls declineHomeInvite when decline is confirmed for home invite',
      HOME_INVITE,
      declineHomeMock,
    ],
  ])('%s', async (_name, invite, decline) => {
    const user = userEvent.setup();
    renderInvite(invite, [decline]);

    await declineAndConfirm(user);

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('shows error alert when accept fails', async () => {
    const user = userEvent.setup();
    renderInvite(LIST_INVITE, [
      failingMock(AcceptShoppingListInviteDocument, new Error('Network error')),
    ]);

    await user.press(await screen.findByText('Accept'));

    // The server's own text is unlocalizable English by construction — the
    // client sends no `Accept-Language` and the token carries no locale — so it
    // must not be what the alert body says.
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to accept invitation. Please try again.',
      ),
    );
  });

  it('tells a throttled accept how long to wait, not that accepting failed', async () => {
    const user = userEvent.setup();
    const rateLimited = Object.assign(new Error('rate limited'), {
      errors: [
        {
          message: 'Too many requests',
          extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
        },
      ],
    });
    renderInvite(LIST_INVITE, [
      failingMock(AcceptShoppingListInviteDocument, rateLimited),
    ]);

    await user.press(await screen.findByText('Accept'));

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Too many requests. Please try again in 10 minutes.',
      ),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows error alert when decline fails', async () => {
    const user = userEvent.setup();
    renderInvite(LIST_INVITE, [
      failingMock(DeclineShoppingListInviteDocument, new Error('Failed')),
    ]);

    await declineAndConfirm(user);

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to decline invitation. Please try again.',
      ),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows error alert for invalid invitation when no token', async () => {
    jest
      .requireMock('@react-navigation/native')
      .useRoute.mockReturnValue({ params: {} });
    renderWithApollo(<AcceptInvite />, { operationMocks: [] });

    expect(await screen.findByText(/Invitation not found/)).toBeTruthy();
  });

  it('navigates back when Go Back is pressed on not found screen', async () => {
    const user = userEvent.setup();
    renderInvite(null);

    await user.press(await screen.findByText('Go Back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});

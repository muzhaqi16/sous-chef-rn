import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockPart,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { withDeadline } from '#/test-utils/cacheWaits';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { kitTestIDs } from '#components/testIDs';
import {
  CollaboratorRole,
  CollaboratorStatus,
  ErrorCode,
  InviteStatus,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { formatRoleDisplay } from '#features/shoppingList/utils/ownershipHelpers';
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
import { AcceptInvite } from '../AcceptInvite';

jest.mock('#hooks/navigation/useAppNavigation');
// The deep link's route is the boundary: the screen reads its token there.
const mockRoute: { params: { token?: string } } = { params: {} };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => mockRoute,
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const TOKEN = 'invite-token';

type ListInvite =
  GetShoppingListInviteByTokenQuery['shoppingListInviteByToken'] &
    AcceptInvite_ShoppingListInviteFragment;
type HomeInvite = GetHomeInviteByTokenQuery['homeInviteByToken'] &
  AcceptInvite_HomeInviteFragment;

/** An editor's invite to My List, from host@test.com, who chose no name. */
const listInvite = (
  invite: MockPart<ListInvite> = {},
): MockPart<ListInvite> => ({
  role: CollaboratorRole.Editor,
  status: CollaboratorStatus.Pending,
  inviterName: null,
  invitedBy: { email: 'host@test.com', displayName: null, profile: null },
  shoppingList: { name: 'My List', description: null },
  ...invite,
});

/** A member's invite to Family Home, from owner@test.com, who chose no name. */
const homeInvite = (
  invite: MockPart<HomeInvite> = {},
): MockPart<HomeInvite> => ({
  role: MembershipRole.Member,
  status: InviteStatus.Pending,
  inviterName: null,
  home: { name: 'Family Home' },
  inviter: { email: 'owner@test.com', displayName: null, profile: null },
  ...invite,
});

type Linked =
  | { list: MockPart<ListInvite> }
  | { home: MockPart<HomeInvite> }
  | null;

let log = operationLog();

/**
 * Opens the deep link on `token`, which resolves to `linked`, and waits for
 * both reads: a token names one kind of invite, so the other answers null.
 */
async function openLink(
  linked: Linked,
  answers: ReturnType<typeof recordMock>[] = [],
  token: string | undefined = TOKEN,
) {
  mockRoute.params = { token };
  const reads = [
    recordMock(GetShoppingListInviteByTokenDocument, {
      data: {
        shoppingListInviteByToken:
          linked && 'list' in linked ? linked.list : null,
      },
    }),
    recordMock(GetHomeInviteByTokenDocument, {
      data: {
        homeInviteByToken: linked && 'home' in linked ? linked.home : null,
      },
    }),
  ];
  renderWithApollo(<AcceptInvite />, {
    links: [log.link],
    operationMocks: [...answers, ...reads].map(answer => answer.mock),
  });
  if (!token) return;
  await log.landed(GetShoppingListInviteByTokenDocument);
  await log.landed(GetHomeInviteByTokenDocument);
}

/** Resolves once the screen leaves. */
const leaves = () =>
  withDeadline(
    done => {
      mockNav.goBack.mockImplementation(done);
      return () => undefined;
    },
    () => 'the screen never left',
  );

/** Resolves once an alert is raised. */
const alerted = () =>
  withDeadline(
    done => {
      jest.mocked(alertService.alert).mockImplementation(() => done());
      return () => undefined;
    },
    () => 'nothing was alerted',
  );

const press = (label: string) =>
  userEvent.setup().press(screen.getByRole('button', { name: label }));

/** Presses Decline, then the confirmation's own Decline. */
async function declineConfirmed() {
  await press(t('labels.decline'));
  await confirmDecline();
}

/** Presses Decline on the confirmation raised last. */
async function confirmDecline() {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls.at(-1) ?? [];
  const { onPress } =
    buttons?.find(button => button.text === t('labels.decline')) ?? {};
  if (!onPress) throw new Error('no Decline on the confirmation');
  await act(async () => {
    onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'invitee@example.com',
      emailVerified: true,
      onBoarded: true,
    },
  });
});

describe('an invite to a list', () => {
  it('says who invited the person, to what, in which role', async () => {
    await openLink({
      list: listInvite({
        shoppingList: { name: 'Weekly Groceries', description: 'Saturdays' },
      }),
    });

    expect(
      screen.getByText(t('invitationAcceptance.invitedHeading')),
    ).toBeTruthy();
    expect(
      screen.getByText(
        t('invitationAcceptance.listInviteText', { inviter: 'host@test.com' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
    expect(screen.getByText(t('labels.shoppingList'))).toBeTruthy();
    expect(
      screen.getByText(formatRoleDisplay(CollaboratorRole.Editor, t)),
    ).toBeTruthy();
    expect(screen.getByText('Saturdays')).toBeTruthy();
  });

  it.each([
    ['the name the invite gives', { inviterName: 'Sam' }, 'Sam'],
    ['someone, with no inviter', { invitedBy: null }, t('labels.someone')],
  ])('names its inviter as %s', async (_, invite, named) => {
    await openLink({ list: listInvite(invite) });

    expect(
      screen.getByText(
        t('invitationAcceptance.listInviteText', { inviter: named }),
      ),
    ).toBeTruthy();
  });

  it('is accepted, said so, and left', async () => {
    const accepted = recordMock(AcceptShoppingListInviteDocument, {
      data: {
        acceptShoppingListInvite: {
          __typename: 'AcceptShoppingListInvitePayload',
        },
      },
    });
    await openLink({ list: listInvite() }, [accepted]);
    const left = leaves();

    await press(t('labels.accept'));
    await left;

    expect(accepted.fired).toEqual([{ input: { token: TOKEN } }]);
    expect(toastService.success).toHaveBeenCalledWith(
      t('invitationAcceptance.shoppingListAccepted'),
    );
  });

  it('offers nothing more while an accept is out', async () => {
    await openLink({ list: listInvite() }, [
      recordMock(AcceptShoppingListInviteDocument, { held: true }),
    ]);

    await press(t('labels.accept'));
    await log.requested(AcceptShoppingListInviteDocument);

    expect(
      screen.getByRole('button', { name: t('labels.decline') }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: t('labels.accept') })).toBeBusy();
  });

  it('is declined once confirmed, and left', async () => {
    const declined = recordMock(DeclineShoppingListInviteDocument, {
      data: {
        declineShoppingListInvite: {
          __typename: 'DeclineShoppingListInvitePayload',
        },
      },
    });
    await openLink({ list: listInvite() }, [declined]);
    const left = leaves();

    await declineConfirmed();
    await left;

    expect(alertService.alert).toHaveBeenCalledWith(
      t('confirmations.declineInvitationTitle'),
      t('invitationAcceptance.declineConfirm'),
      expect.any(Array),
    );
    expect(declined.fired).toEqual([{ input: { token: TOKEN } }]);
  });

  // A refusal is a member of a 200 answer: nothing throws.
  it.each([
    ['NotFoundError', ErrorCode.NotFound, t('errors.invitationUnavailable')],
    [
      'ForbiddenError',
      ErrorCode.Forbidden,
      t('invitationAcceptance.wrongAccountTitle'),
    ],
    ['ConflictError', ErrorCode.Conflict, undefined],
  ] as const)(
    'stays, saying so, when an accept is refused as %s',
    async (typename, code, said) => {
      await openLink({ list: listInvite() }, [
        recordMock(AcceptShoppingListInviteDocument, {
          data: { acceptShoppingListInvite: { __typename: typename, code } },
        }),
      ]);
      const raised = alerted();

      await press(t('labels.accept'));
      await raised;

      const shown = jest.mocked(alertService.alert).mock.calls.flat();
      if (said) expect(shown).toContain(said);
      expect(toastService.success).not.toHaveBeenCalled();
      expect(mockNav.goBack).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'an accept that cannot be sent',
      () =>
        recordMock(AcceptShoppingListInviteDocument, {
          error: new Error('Network error'),
        }),
      t('invitationAcceptance.acceptFailed'),
    ],
    [
      'a throttled accept, saying how long to wait',
      () =>
        recordMock(AcceptShoppingListInviteDocument, {
          error: Object.assign(new Error('rate limited'), {
            errors: [
              {
                message: 'Too many requests',
                extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
              },
            ],
          }),
        }),
      t('errors.rateLimitMinutes', { count: 10 }),
    ],
    [
      'a decline that cannot be sent',
      () =>
        recordMock(DeclineShoppingListInviteDocument, {
          error: new Error('Failed'),
        }),
      t('invitationAcceptance.declineFailed'),
    ],
  ])('stays after %s', async (name, answer, said) => {
    await openLink({ list: listInvite() }, [answer()]);

    if (name.includes('decline')) {
      await press(t('labels.decline'));
      const raised = alerted();
      await confirmDecline();
      await raised;
    } else {
      const raised = alerted();
      await press(t('labels.accept'));
      await raised;
    }
    // The alert comes before the press's own promise has run out.
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      said,
    );
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });
});

describe('an invite to a home', () => {
  it('says who invited the person to join it, in which role', async () => {
    await openLink({
      home: homeInvite({
        role: MembershipRole.Admin,
        home: { name: 'Beach House' },
      }),
    });

    expect(
      screen.getByText(
        t('invitationAcceptance.homeInviteText', { inviter: 'owner@test.com' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText('Beach House')).toBeTruthy();
    expect(screen.getByText(t('labels.home'))).toBeTruthy();
    expect(
      screen.getByText(formatRoleDisplay(MembershipRole.Admin, t)),
    ).toBeTruthy();
  });

  it.each([
    ['the name the invite gives', { inviterName: 'Ana' }, 'Ana'],
    [
      'the name the inviter chose',
      {
        inviter: {
          email: 'owner@test.com',
          displayName: 'HomeOwner',
          profile: { displayName: 'HomeOwner' },
        },
      },
      'HomeOwner',
    ],
    [
      'someone, with neither a name nor an email',
      {
        inviter: { email: '', displayName: null, profile: null },
      },
      t('labels.someone'),
    ],
  ])('names its inviter as %s', async (_, invite, named) => {
    await openLink({ home: homeInvite(invite) });

    expect(
      screen.getByText(
        t('invitationAcceptance.homeInviteText', { inviter: named }),
      ),
    ).toBeTruthy();
  });

  it('is accepted, said so, and left', async () => {
    const accepted = recordMock(AcceptHomeInviteDocument, {
      data: { acceptHomeInvite: { __typename: 'AcceptHomeInvitePayload' } },
    });
    await openLink({ home: homeInvite() }, [accepted]);
    const left = leaves();

    await press(t('labels.accept'));
    await left;

    expect(accepted.fired).toEqual([{ input: { token: TOKEN } }]);
    expect(toastService.success).toHaveBeenCalledWith(
      t('invitationAcceptance.homeAccepted'),
    );
  });

  it('is declined once confirmed, and left', async () => {
    const declined = recordMock(DeclineHomeInviteDocument, {
      data: { declineHomeInvite: { __typename: 'DeclineHomeInvitePayload' } },
    });
    await openLink({ home: homeInvite() }, [declined]);
    const left = leaves();

    await declineConfirmed();
    await left;

    expect(declined.fired).toEqual([{ input: { token: TOKEN } }]);
  });
});

// The gate is the hook's, so it holds for both kinds of invite.
describe('for an account that has not verified its email', () => {
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

  it.each([
    [
      'a list',
      { list: listInvite() },
      () => recordMock(AcceptShoppingListInviteDocument, { held: true }),
    ],
    [
      'a home',
      { home: homeInvite() },
      () => recordMock(AcceptHomeInviteDocument, { held: true }),
    ],
  ] as const)(
    'offers verification instead of accepting %s',
    async (_, linked, answer) => {
      const accept = answer();
      await openLink(linked, [accept]);

      await press(t('labels.accept'));

      expect(alertService.alert).toHaveBeenCalledWith(
        t('auth.verifyToCollaborateTitle'),
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: t('auth.verifyNow') }),
        ]),
      );
      expect(accept.fired).toHaveLength(0);
      expect(mockNav.goBack).not.toHaveBeenCalled();
    },
  );

  // Declining shares nothing, and the API takes it from an unverified account.
  it('still declines', async () => {
    await openLink({ list: listInvite() }, [
      recordMock(DeclineShoppingListInviteDocument, {
        data: {
          declineShoppingListInvite: {
            __typename: 'DeclineShoppingListInvitePayload',
          },
        },
      }),
    ]);
    const left = leaves();

    await declineConfirmed();

    await expect(left).resolves.toBeUndefined();
  });
});

describe('a link that resolves to no invite', () => {
  it.each([
    [
      'an accepted home invite',
      { home: homeInvite({ status: InviteStatus.Accepted }) },
    ],
    [
      'a revoked home invite',
      { home: homeInvite({ status: InviteStatus.Revoked }) },
    ],
    [
      'a list invite already taken up',
      { list: listInvite({ status: CollaboratorStatus.Active }) },
    ],
  ] as const)('offers nothing to accept on %s', async (_, linked) => {
    await openLink(linked);

    expect(screen.getByText(t('errors.invitationUnavailable'))).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: t('labels.accept') }),
    ).not.toBeOnTheScreen();
  });

  it.each([
    ['no invite', TOKEN],
    ['no token', undefined],
  ])(
    'says it was not found for %s, and goes back from there',
    async (_, token) => {
      await openLink(null, [], token);

      expect(screen.getByText(t('invitationAcceptance.notFound'))).toBeTruthy();
      await press(t('labels.goBack'));

      expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    },
  );

  it('offers nothing while the invite is being read', async () => {
    mockRoute.params = { token: TOKEN };
    renderWithApollo(<AcceptInvite />, {
      links: [log.link],
      operationMocks: [
        recordMock(GetShoppingListInviteByTokenDocument, { held: true }).mock,
        recordMock(GetHomeInviteByTokenDocument, { held: true }).mock,
      ],
    });
    await log.requested(GetHomeInviteByTokenDocument);

    expect(
      screen.queryByRole('button', { name: t('labels.accept') }),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByText(t('invitationAcceptance.notFound')),
    ).not.toBeOnTheScreen();
  });

  it('offers a retry when the invite could not be read, which reads it again', async () => {
    mockRoute.params = { token: TOKEN };
    renderWithApollo(<AcceptInvite />, {
      links: [log.link],
      operationMocks: [
        recordMock(GetShoppingListInviteByTokenDocument, {
          error: new Error('Server error'),
        }).mock,
        recordMock(GetHomeInviteByTokenDocument, {
          error: new Error('Server error'),
        }).mock,
      ],
    });
    await log.landed(GetShoppingListInviteByTokenDocument);
    await log.landed(GetHomeInviteByTokenDocument);

    await press(t('labels.tryAgain'));

    await expect(
      log.requested(GetHomeInviteByTokenDocument, 2),
    ).resolves.toBeUndefined();
  });
});

it('closes from its header', async () => {
  await openLink({ list: listInvite() });

  await userEvent
    .setup()
    .press(screen.getByTestId(kitTestIDs.headerCloseButton));

  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

import React from 'react';
import { RefreshControl } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  collaboratorsOf,
  listCollaborator,
  listDetailsRead,
  listOwner,
  ownShoppingList,
  type ShoppingListNode,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useStore } from '#store';
import { t, type TranslationKey } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  CollaboratorRole,
  CollaboratorStatus,
  ErrorCode,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import {
  GetShoppingListDetailsDocument,
  RemoveCollaboratorDocument,
  UpdateCollaboratorRoleDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ShareList } from '../ShareList';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'u1';
const OWNER = 'u2';
const person = {
  id: ME,
  email: `${ME}@example.com`,
  emailVerified: true,
  onBoarded: true,
};

/** A list shared by its owner, as the share screen reads it. */
const sharedList = (
  overrides: Partial<ShoppingListNode> = {},
): ShoppingListNode => ({
  ...ownShoppingList('sl1', 'Weekly Groceries'),
  isPublic: true,
  shareCode: 'ABC123',
  shareLink: { __typename: 'ShareLink', universal: 'https://example.com/s/1' },
  ownerships: [listOwner(ME, 'Sam')],
  collaboratorsConnection: collaboratorsOf(
    listCollaborator('u3', { email: 'alex@example.com' }),
    listCollaborator('u4', {
      email: 'kim@example.com',
      status: CollaboratorStatus.Pending,
    }),
    listCollaborator('u5', {
      email: 'gone@example.com',
      status: CollaboratorStatus.Removed,
    }),
  ),
  ...overrides,
});

/** The same list, someone else's, shared with me as `me`. */
const sharedWithMe = (me: Parameters<typeof listCollaborator>[1] = {}) =>
  sharedList({
    ownerships: [listOwner(OWNER, 'Alex')],
    collaboratorsConnection: collaboratorsOf(
      listCollaborator(OWNER, { email: 'owner@example.com' }),
      listCollaborator(ME, { email: person.email, ...me }),
    ),
  });

let log = operationLog();

async function openShare(
  list: ShoppingListNode,
  answers: ReturnType<typeof recordMock>[] = [],
) {
  renderWithApollo(<ShareList route={{ params: { listId: 'sl1' } }} />, {
    cache: makeCache(),
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      listDetailsRead(list).mock,
    ],
  });
  await log.landed(GetShoppingListDetailsDocument);
}

/** Presses `label` on the last alert raised, as the person answers it. */
function answerAlert(label: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls.at(-1) ?? [];
  const button = buttons?.find(candidate => candidate.text === label);
  const { onPress } = button ?? {};
  if (!onPress) throw new Error(`no ${label} on the last alert`);
  act(() => onPress());
}

const roleChip = (role: TranslationKey) => screen.queryByText(t(role));

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({ user: person, isOnline: true, apiReachable: true });
});

describe('reading the list', () => {
  it('says a cold read failed, and reads again on a retry', async () => {
    renderWithApollo(<ShareList route={{ params: { listId: 'sl1' } }} />, {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        recordMock(GetShoppingListDetailsDocument, {
          error: new Error('Network request failed'),
        }).mock,
      ],
    });
    await log.landed(GetShoppingListDetailsDocument);

    fireEvent.press(screen.getByText(t('labels.tryAgain')));

    await expect(
      log.requested(GetShoppingListDetailsDocument, 2),
    ).resolves.toBeUndefined();
  });

  it('reads again on a pull, spinning only while it does', async () => {
    await openShare(sharedList());
    const control = () => screen.UNSAFE_getByType(RefreshControl).props;

    act(() => {
      control().onRefresh();
    });
    expect(control().refreshing).toBe(true);
    await log.landed(GetShoppingListDetailsDocument, 2);

    expect(control().refreshing).toBe(false);
  });
});

describe('the owner', () => {
  it('shares by code and invites in any role', async () => {
    await openShare(sharedList());

    expect(
      screen.getByText(t('shoppingListScreens.shareViaCode')),
    ).toBeTruthy();
    expect(roleChip('collaboratorRoles.editor')).toBeTruthy();
  });

  it('sees who it is shared with and who is invited, not who was removed', async () => {
    await openShare(sharedList());

    expect(screen.getByText('alex@example.com')).toBeTruthy();
    expect(screen.getByText('kim@example.com')).toBeTruthy();
    expect(screen.queryByText('gone@example.com')).not.toBeOnTheScreen();
  });

  it('removes a member once confirmed', async () => {
    const removal = recordMock(RemoveCollaboratorDocument, { held: true });
    await openShare(sharedList(), [removal]);

    const [removeAlex] = screen.getAllByLabelText(
      t('shoppingListScreens.removeMemberA11y'),
    );
    if (!removeAlex) throw new Error('no remove');
    fireEvent.press(removeAlex);
    answerAlert(t('labels.remove'));
    await log.requested(RemoveCollaboratorDocument);

    expect(removal.fired[0]).toMatchObject({ input: { id: 'c-u3' } });
  });

  it('changes a member’s role, and reads the list again', async () => {
    const change = recordMock(UpdateCollaboratorRoleDocument, {
      data: {
        updateCollaboratorRole: {
          __typename: 'UpdateCollaboratorRolePayload',
        },
      },
    });
    await openShare(sharedList(), [change]);

    fireEvent.press(screen.getByText('alex@example.com'));
    expect(screen.getByText(t('collaborators.editPermissions'))).toBeTruthy();
    // The sheet's role cards come after the invite's chips.
    const editor = screen.getAllByText(t('collaboratorRoles.editor')).at(-1);
    if (!editor) throw new Error('no Editor card');
    fireEvent.press(editor);
    fireEvent.press(screen.getByText(t('labels.update')));
    await log.landed(UpdateCollaboratorRoleDocument);

    expect(change.fired[0]).toMatchObject({
      input: { role: CollaboratorRole.Editor },
    });
    await expect(
      log.requested(GetShoppingListDetailsDocument, 2),
    ).resolves.toBeUndefined();
  });

  it('is tagged owner, and never offered a way to leave', async () => {
    await openShare(
      sharedList({
        collaboratorsConnection: collaboratorsOf(
          listCollaborator(ME, { email: person.email }),
        ),
      }),
    );

    expect(screen.getByText(t('shoppingListScreens.owner'))).toBeTruthy();
    expect(screen.queryByText(t('labels.leaveList'))).not.toBeOnTheScreen();
  });
});

describe('a collaborator', () => {
  it('invites only in roles their own row allows, and manages no one', async () => {
    await openShare(
      sharedWithMe({
        role: CollaboratorRole.Contributor,
        canInviteOthers: true,
        canAddItems: true,
        canEditItems: true,
        canMarkPurchased: true,
      }),
    );

    expect(
      screen.queryByText(t('shoppingListScreens.shareViaCode')),
    ).not.toBeOnTheScreen();
    expect(roleChip('collaboratorRoles.contributor')).toBeTruthy();
    expect(roleChip('collaboratorRoles.editor')).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText(t('shoppingListScreens.removeMemberA11y')),
    ).not.toBeOnTheScreen();
    // A person's press: the card takes none for someone who may not manage.
    await userEvent.setup().press(screen.getByText('owner@example.com'));
    expect(
      screen.queryByText(t('collaborators.editPermissions')),
    ).not.toBeOnTheScreen();
  });

  it('invites no one while their own invitation is pending', async () => {
    await openShare(
      sharedWithMe({
        status: CollaboratorStatus.Pending,
        canInviteOthers: true,
      }),
    );

    expect(
      screen.queryByLabelText(t('labels.inviteMembers')),
    ).not.toBeOnTheScreen();
  });

  it('leaves once confirmed, by their own row, and goes back', async () => {
    const leave = recordMock(RemoveCollaboratorDocument, {
      data: {
        removeShoppingListCollaborator: {
          __typename: 'RemoveShoppingListCollaboratorPayload',
        },
      },
    });
    await openShare(sharedWithMe(), [leave]);

    fireEvent.press(screen.getByText(t('labels.leaveList')));
    answerAlert(t('labels.leaveList'));
    await log.landed(RemoveCollaboratorDocument);

    expect(leave.fired[0]).toMatchObject({ input: { id: `c-${ME}` } });
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('cannot leave twice while leaving', async () => {
    await openShare(sharedWithMe(), [
      recordMock(RemoveCollaboratorDocument, { held: true }),
    ]);

    fireEvent.press(screen.getByText(t('labels.leaveList')));
    answerAlert(t('labels.leaveList'));
    await log.requested(RemoveCollaboratorDocument);

    expect(
      screen.getByRole('button', { name: t('labels.leaveList') }),
    ).toBeDisabled();
  });

  it('is told when leaving fails, and stays', async () => {
    await openShare(sharedWithMe(), [
      recordMock(RemoveCollaboratorDocument, {
        data: {
          removeShoppingListCollaborator: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No',
          },
        },
      }),
    ]);

    fireEvent.press(screen.getByText(t('labels.leaveList')));
    answerAlert(t('labels.leaveList'));
    await log.landed(RemoveCollaboratorDocument);

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      t('shoppingListScreens.failedToLeave'),
    );
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  // A row with no email is never taken for a person with none on record.
  it('is not mistaken for another member when neither has an email', async () => {
    useStore.setState({ user: { ...person, email: null } });

    await openShare(
      sharedList({
        ownerships: [listOwner(OWNER, 'Alex')],
        collaboratorsConnection: collaboratorsOf(
          listCollaborator('u3', { email: null }),
        ),
      }),
    );

    expect(screen.queryByText(t('labels.leaveList'))).not.toBeOnTheScreen();
  });
});

describe('a list in a home', () => {
  const inHome: ShoppingListNode = {
    ...sharedWithMe(),
    homeId: 'h1',
    home: {
      __typename: 'Home',
      id: 'h1',
      name: 'Family',
      myMembership: {
        __typename: 'Membership',
        id: 'm1',
        role: MembershipRole.Member,
      },
    },
  };

  it('is shared through the home, not here', async () => {
    await openShare(inHome);

    expect(
      screen.getByText(
        t('shoppingListScreens.shareHomeLinkedNotice', { name: 'Family' }),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(t('labels.leaveList'))).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText(t('shoppingListScreens.manageHome')));

    expect(mockNav.toHomeDetail).toHaveBeenCalledWith({ homeId: 'h1' });
  });
});

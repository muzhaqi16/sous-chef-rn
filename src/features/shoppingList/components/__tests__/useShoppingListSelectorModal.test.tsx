import React, { useEffect } from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  homeShoppingList,
  listDetailsRead,
  listLinesRead,
  listOwner,
  listsRead,
  ownShoppingList,
  type ShoppingListNode,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { ErrorCode, MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  TabBarActionsProvider,
  useTabBarState,
} from '#/context/TabBarActionsContext';
import {
  DeleteShoppingListDocument,
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { GetPendingListInvitesDocument } from '#features/shoppingList/hooks/usePendingListInvites.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { ShoppingListMain } from '#features/shoppingList/screens/ShoppingListMain';

jest.mock('#hooks/navigation/useAppNavigation');
// No navigator: the screen counts as focused while mounted.
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
    useIsFocused: () => true,
    useRoute: () => ({ params: {} }),
  };
});
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerParentDeletion: jest.fn(),
    unregisterParentDeletion: jest.fn(),
  },
}));

// A skeleton's minimum time on screen is a clock, held by its own test.
jest.mock('#features/shoppingList/hooks/useMinimumVisible', () => ({
  useMinimumVisible: (active: boolean) => active,
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'u1';
const ALEX = 'u2';

/** My own list, five lines of which two are done. */
const GROCERIES: ShoppingListNode = {
  ...ownShoppingList('list-1', 'Groceries'),
  ownerships: [listOwner(ME, 'Sam')],
  totalItems: 5,
  completedItems: 2,
};
/** Alex's list in our home, which as a member I may not delete. */
const PARTY: ShoppingListNode = {
  ...homeShoppingList('list-2', 'Party', {
    role: MembershipRole.Member,
    homeName: 'Family Home',
  }),
  ownerships: [listOwner(ALEX, 'Alex')],
  totalItems: 0,
  completedItems: 0,
};
/** Alex's list in a home I run, which I may delete. */
const CAMPING: ShoppingListNode = {
  ...homeShoppingList('list-3', 'Camping', {
    role: MembershipRole.Admin,
    homeId: 'h2',
    homeName: 'Cabin',
  }),
  ownerships: [listOwner(ALEX, 'Alex')],
  totalItems: 0,
  completedItems: 0,
};

/** Whether the shell's overlay is up, as the tab bar reads it. */
const shell: { overlayOpen?: boolean } = {};
function OverlayProbe() {
  const { isOverlayOpen } = useTabBarState();
  useEffect(() => {
    shell.overlayOpen = isOverlayOpen;
  });
  return null;
}

let log = operationLog();

/** The list tab, on Groceries, its switcher opened. */
async function openSwitcher(
  answers: ReturnType<typeof recordMock>[] = [],
  lists: ShoppingListNode[] = [GROCERIES, PARTY, CAMPING],
) {
  renderWithApollo(
    <TabBarActionsProvider>
      <OverlayProbe />
      <ShoppingListMain />
    </TabBarActionsProvider>,
    {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        listsRead(lists).mock,
        listDetailsRead(GROCERIES).mock,
        listLinesRead('list-1', []).mock,
        recordMock(GetPendingListInvitesDocument, {
          data: {
            me: {
              __typename: 'User',
              id: ME,
              pendingCollaborationInvitesConnection: {
                __typename: 'ShoppingListCollaboratorConnection',
                edges: [],
              },
            },
          },
        }).mock,
      ],
    },
  );
  await log.landed(GetShoppingListsLiteDocument);
  await log.landed(GetShoppingListDetailsDocument);
  await log.landed(GetShoppingListItemsFilteredDocument, 2);
  fireEvent.press(screen.getByTestId(shoppingListTestIDs.listSelectorButton));
}

/** Presses `label` on the last alert raised, as the person answers it. */
function answerAlert(label: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls.at(-1) ?? [];
  const button = buttons?.find(candidate => candidate.text === label);
  if (!button?.onPress) throw new Error(`no ${label} on the last alert`);
  button.onPress();
}

/** A list's row in the switcher; the one on screen is the header's title too. */
function row(name: string) {
  const match = screen.getAllByText(name).at(-1);
  if (!match) throw new Error(`no row named ${name}`);
  return match;
}

const deleted = (count: number) =>
  t('shoppingListSelector.deletedToast', { count });

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  shell.overlayOpen = undefined;
  useStore.setState({
    user: {
      id: ME,
      email: 'sam@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    selectedShoppingListId: 'list-1',
    isOnline: true,
    apiReachable: true,
  });
});

describe('the switcher', () => {
  it('groups personal lists apart from each home’s', async () => {
    await openSwitcher();

    expect(
      screen.getByText(t('shoppingListSelector.personalLists')),
    ).toBeTruthy();
    expect(screen.getByText('Family Home')).toBeTruthy();
    expect(screen.getByText('Cabin')).toBeTruthy();
  });

  it('says who shared a list, and what is left on one with lines', async () => {
    await openSwitcher();

    expect(
      screen.getAllByText(t('shoppingListSelector.sharedBy', { name: 'Alex' })),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        t('shoppingListSelector.itemsRemaining', { remaining: 3, total: 5 }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        t('shoppingListSelector.itemsRemaining', { remaining: 0, total: 0 }),
      ),
    ).not.toBeOnTheScreen();
  });

  it('switches to the list picked', async () => {
    await openSwitcher();

    fireEvent.press(row('Party'));

    expect(useStore.getState().selectedShoppingListId).toBe('list-2');
  });

  it('switches to no section header', async () => {
    await openSwitcher();

    fireEvent.press(screen.getByText('Family Home'));

    expect(useStore.getState().selectedShoppingListId).toBe('list-1');
  });

  it('makes a new list, closing itself first', async () => {
    await openSwitcher();
    expect(shell.overlayOpen).toBe(true);

    fireEvent.press(screen.getByText(t('labels.create')));

    expect(shell.overlayOpen).toBe(false);
    expect(mockNav.toListSettings).toHaveBeenCalledWith();
  });

  it('shares and sets up the list on screen', async () => {
    await openSwitcher();

    fireEvent.press(
      screen.getByText(t('shoppingListSelector.shareCurrentList')),
    );
    fireEvent.press(screen.getByText(t('shoppingListSelector.listSettings')));

    expect(mockNav.toShareList).toHaveBeenCalledWith({ listId: 'list-1' });
    expect(mockNav.toListSettings).toHaveBeenCalledWith({ listId: 'list-1' });
  });
});

describe('deleting from the switcher', () => {
  /** A long-press, held then let go, as a finger does. */
  const longPress = (name: string) => {
    fireEvent(row(name), 'longPress');
    fireEvent.press(row(name));
  };
  const deleteButton = () =>
    screen.getByRole('button', { name: t('labels.delete') });

  it('starts from a long-press on a list one may delete, picked', async () => {
    await openSwitcher();

    longPress('Groceries');

    expect(
      screen.getByText(t('shoppingListSelector.deleteModeTitle', { count: 1 })),
    ).toBeTruthy();
    expect(deleteButton()).toBeEnabled();
  });

  it('never starts on a list one may not delete, which says so', async () => {
    await openSwitcher();

    longPress('Party');
    expect(
      screen.queryByText(
        t('shoppingListSelector.deleteModeTitle', { count: 1 }),
      ),
    ).not.toBeOnTheScreen();

    longPress('Groceries');
    fireEvent.press(row('Party'));

    expect(
      screen.getByText(t('shoppingListSelector.cannotDeleteShared')),
    ).toBeTruthy();
    expect(
      screen.getByText(t('shoppingListSelector.deleteModeTitle', { count: 1 })),
    ).toBeTruthy();
  });

  it('switches nothing while picking, and offers no delete with none picked', async () => {
    await openSwitcher();

    longPress('Groceries');
    fireEvent.press(row('Groceries'));
    fireEvent.press(row('Camping'));

    expect(useStore.getState().selectedShoppingListId).toBe('list-1');
    expect(
      screen.getByText(t('shoppingListSelector.deleteModeTitle', { count: 1 })),
    ).toBeTruthy();
    fireEvent.press(row('Camping'));
    expect(deleteButton()).toBeDisabled();
  });

  it('deletes one list once confirmed, naming it, and moves off it', async () => {
    const removal = recordMock(DeleteShoppingListDocument, {
      data: {
        deleteShoppingList: { __typename: 'DeleteShoppingListPayload' },
      },
    });
    await openSwitcher([removal]);

    longPress('Groceries');
    fireEvent.press(deleteButton());
    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.deleteNamed', { name: 'Groceries' }),
      expect.any(String),
      expect.any(Array),
    );
    answerAlert(t('labels.delete'));
    await log.landed(DeleteShoppingListDocument);

    expect(removal.fired[0]).toMatchObject({ input: { id: 'list-1' } });
    expect(useStore.getState().selectedShoppingListId).toBe('list-2');
    expect(toastService.success).toHaveBeenCalledWith(deleted(1));
  });

  it('counts only what the server deleted', async () => {
    await openSwitcher([
      recordMock(DeleteShoppingListDocument, {
        match: variables => JSON.stringify(variables).includes('list-3'),
        data: {
          deleteShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No',
          },
        },
      }),
      recordMock(DeleteShoppingListDocument, {
        data: {
          deleteShoppingList: { __typename: 'DeleteShoppingListPayload' },
        },
      }),
    ]);

    longPress('Groceries');
    fireEvent.press(row('Camping'));
    fireEvent.press(deleteButton());
    answerAlert(t('labels.delete'));
    await log.landed(DeleteShoppingListDocument, 2);

    expect(toastService.success).toHaveBeenCalledWith(deleted(1));
  });

  // The removal shows at once and the List moves off it; the refusal brings
  // both back.
  it('says nothing was deleted when the server refused all of it, and stays on the list', async () => {
    await openSwitcher([
      recordMock(DeleteShoppingListDocument, {
        data: {
          deleteShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No',
          },
        },
      }),
    ]);

    longPress('Groceries');
    fireEvent.press(deleteButton());
    answerAlert(t('labels.delete'));
    await log.landed(DeleteShoppingListDocument);

    expect(toastService.success).not.toHaveBeenCalled();
    expect(useStore.getState().selectedShoppingListId).toBe('list-1');
  });

  it('is left on Cancel', async () => {
    await openSwitcher();

    longPress('Groceries');
    fireEvent.press(screen.getByText(t('labels.cancel')));

    expect(screen.getByText(t('shoppingListSelector.title'))).toBeTruthy();
  });
});

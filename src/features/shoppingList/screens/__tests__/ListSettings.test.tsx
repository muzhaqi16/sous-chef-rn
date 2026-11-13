import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedFragment,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { memoryIntents } from '#/test-utils/memoryPlatform';
import {
  collaboratorsOf,
  listCollaborator,
  listDetailsRead,
  listOwner,
  ownShoppingList,
  type ShoppingListNode,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { Text as AppText } from '#components/atoms/Text';
import {
  CollaboratorRole,
  ErrorCode,
  ListStatus,
  MembershipRole,
  RecurringPattern,
} from '#/graphql/generated/schemaTypes';
import {
  CancelRecurringDocument,
  CompleteShoppingListDocument,
  CreateRecurringShoppingListDocument,
  CreateShoppingListDocument,
  DeleteShoppingListDocument,
  DeleteShoppingListReminderDocument,
  GetShoppingListDetailsDocument,
  GetShoppingListTemplatesDocument,
  MarkAsTemplateDocument,
  MarkShoppingListActiveDocument,
  MarkShoppingListAsDefaultDocument,
  RemoveCollaboratorDocument,
  UpdateShoppingListDocument,
  UpdateShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { CopyableShoppingListFragmentDoc } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { COPYABLE_ITEM_LIMIT } from '#features/shoppingList/cache/copySource';
import { GetHomesDocument } from '#operations/home/home.generated';
import { LIST_NAME_MAX_LENGTH } from '#features/shoppingList/utils/shoppingListConstants';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { ListSettings } from '../ListSettings';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerParentDeletion: jest.fn(),
    unregisterParentDeletion: jest.fn(),
  },
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const USER_ID = 'u1';
const OTHER_ID = 'u2';
const person = {
  id: USER_ID,
  email: 'cook@example.com',
  emailVerified: true,
  onBoarded: true,
};

/** Whose list it is: mine, or Alex's. */
const ownedBy = (userId: string) =>
  listOwner(userId, userId === USER_ID ? 'Sam' : 'Alex');

/**
 * A list as its settings read it. Every flag is stated: completion would
 * answer a missing one `true`.
 */
const settingsList = (
  overrides: Partial<ShoppingListNode> = {},
): ShoppingListNode => ({
  ...ownShoppingList('sl1', 'Weekly Groceries'),
  isDefault: false,
  status: ListStatus.Active,
  isCompleted: false,
  completedShopDate: null,
  isRecurring: false,
  recurringPattern: null,
  nextRecurringDate: null,
  isTemplate: false,
  templateName: null,
  basedOnTemplate: null,
  reminderEnabled: false,
  reminderDate: null,
  ownerships: [ownedBy(USER_ID)],
  collaboratorsConnection: collaboratorsOf(),
  ...overrides,
});

/** A list in a home, owned by someone else, read by a member of `role`. */
const homeList = (role: MembershipRole) =>
  settingsList({
    homeId: 'h1',
    home: {
      __typename: 'Home',
      id: 'h1',
      name: 'Family',
      myMembership: { __typename: 'Membership', id: 'm1', role },
    },
    ownerships: [ownedBy(OTHER_ID)],
  });

let log = operationLog();

/** An existing list's settings, its read answered by `list`. */
async function openSettings(
  list: ShoppingListNode,
  answers: ReturnType<typeof recordMock>[] = [],
  cache = makeCache(),
) {
  const view = renderWithApollo(
    <ListSettings route={{ params: { listId: 'sl1' } }} />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        listDetailsRead(list).mock,
      ],
    },
  );
  await log.landed(GetShoppingListDetailsDocument);
  return view;
}

/** The create screen, offered `templates` to start from. */
async function openNewList(
  answers: ReturnType<typeof recordMock>[] = [],
  templates: Template[] = [],
) {
  const view = renderWithApollo(
    <ListSettings route={{ params: undefined }} />,
    {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        templatesRead(templates).mock,
      ],
    },
  );
  await log.landed(GetShoppingListTemplatesDocument);
  return view;
}

interface Template {
  id: string;
  name: string;
}
type TemplateEdge = NonNullable<
  NonNullable<
    NonNullable<
      MockDataFor<typeof GetShoppingListTemplatesDocument>['shoppingLists']
    >['edges']
  >[number]
>;

/** The saved templates, each with the lines a copy starts from. */
const templatesRead = (templates: Template[]) =>
  recordMock(GetShoppingListTemplatesDocument, {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: templates.map(
          ({ id, name }): TemplateEdge => ({
            __typename: 'ShoppingListEdge',
            cursor: id,
            node: {
              __typename: 'ShoppingList',
              id,
              name,
              templateName: name,
              unpurchasedLines: {
                __typename: 'ShoppingListItemConnection',
                edges: [],
              },
            },
          }),
        ),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });

/** The list's lines cached whole, as a copy of it starts from them. */
function cachedForCopy() {
  const cache = makeCache();
  seedFragment(cache, {
    fragment: CopyableShoppingListFragmentDoc,
    fragmentName: 'CopyableShoppingListFragment',
    variables: { copyableItemLimit: COPYABLE_ITEM_LIMIT },
    data: {
      __typename: 'ShoppingList',
      id: 'sl1',
      name: 'Weekly Groceries',
      homeId: null,
      unpurchasedLines: { __typename: 'ShoppingListItemConnection', edges: [] },
      purchasedLines: { __typename: 'ShoppingListItemConnection', edges: [] },
    },
  });
  return cache;
}

/** Creates whatever list it is sent, under the id the device minted. */
const createAnswer = () =>
  recordMock(CreateShoppingListDocument, {
    dataFor: (variables): MockDataFor<typeof CreateShoppingListDocument> => ({
      createShoppingList: {
        __typename: 'CreateShoppingListPayload',
        shoppingList: {
          __typename: 'ShoppingList',
          id: String(inputOf(variables).id),
        },
      },
    }),
  });

/** Presses `label` on the last alert raised, as the person answers it. */
function answerAlert(label: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls.at(-1) ?? [];
  const button = buttons?.find(candidate => candidate.text === label);
  if (!button?.onPress) throw new Error(`no ${label} on the last alert`);
  button.onPress();
}

const save = () => screen.getByText(t('labels.save'));

/** The bar's Save reads in the accent only with something to save. */
const saveReadsChanged = () =>
  screen
    .UNSAFE_getAllByType(AppText)
    .find(node => node.props.children === t('labels.save'))?.props.tone !==
  'primary';

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({ user: person, selectedShoppingListId: 'sl1' });
});

describe('an owner’s list', () => {
  it('is filled in as it stands, with nothing to save until it changes', async () => {
    await openSettings(settingsList({ isDefault: true }));

    expect(
      screen.getByText(t('shoppingListScreens.listSettings')),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('Weekly Groceries')).toBeTruthy();
    expect(
      screen.getByLabelText(t('shoppingListScreens.defaultList')).props.value,
    ).toBe(true);
    expect(saveReadsChanged()).toBe(false);
    // A list moves home from the home's screen, never here.
    expect(
      screen.queryByText(t('shoppingListScreens.linkToHome')),
    ).not.toBeOnTheScreen();

    fireEvent(
      screen.getByLabelText(t('shoppingListScreens.defaultList')),
      'valueChange',
      false,
    );
    expect(saveReadsChanged()).toBe(true);
  });

  it('caps the name at the length the server accepts', async () => {
    await openSettings(settingsList());

    expect(screen.getByDisplayValue('Weekly Groceries').props.maxLength).toBe(
      LIST_NAME_MAX_LENGTH,
    );
  });

  it('saves a rename, trimmed', async () => {
    const update = recordMock(UpdateShoppingListDocument, { held: true });
    await openSettings(settingsList(), [update]);

    fireEvent.changeText(
      screen.getByDisplayValue('Weekly Groceries'),
      '  Pantry run ',
    );
    fireEvent.press(save());
    await log.requested(UpdateShoppingListDocument);

    expect(update.fired[0]).toMatchObject({
      input: { name: 'Pantry run' },
    });
  });

  it('refuses an empty name, writing nothing', async () => {
    const update = recordMock(UpdateShoppingListDocument, { held: true });
    await openSettings(settingsList(), [update]);

    fireEvent.changeText(screen.getByDisplayValue('Weekly Groceries'), '  ');
    fireEvent.press(save());

    expect(toastService.error).toHaveBeenCalledWith(t('errors.listNameEmpty'));
    expect(update.fired).toEqual([]);
  });

  it('becomes the default through the write that unsets the old one', async () => {
    const markDefault = recordMock(MarkShoppingListAsDefaultDocument, {
      held: true,
    });
    await openSettings(settingsList(), [markDefault]);

    fireEvent(
      screen.getByLabelText(t('shoppingListScreens.defaultList')),
      'valueChange',
      true,
    );
    fireEvent.press(save());
    await log.requested(MarkShoppingListAsDefaultDocument);

    expect(markDefault.fired[0]).toMatchObject({ input: { id: 'sl1' } });
  });

  it('stops being the default with the save', async () => {
    const update = recordMock(UpdateShoppingListDocument, { held: true });
    await openSettings(settingsList({ isDefault: true }), [update]);

    fireEvent(
      screen.getByLabelText(t('shoppingListScreens.defaultList')),
      'valueChange',
      false,
    );
    fireEvent.press(save());
    await log.requested(UpdateShoppingListDocument);

    expect(update.fired[0]).toMatchObject({ input: { isDefault: false } });
  });

  it('cannot be saved twice while a save is going', async () => {
    await openSettings(settingsList(), [
      recordMock(UpdateShoppingListDocument, { held: true }),
    ]);

    fireEvent.changeText(screen.getByDisplayValue('Weekly Groceries'), 'Shop');
    fireEvent.press(save());
    await log.requested(UpdateShoppingListDocument);

    expect(
      screen.getByRole('button', { name: t('labels.saving') }),
    ).toBeDisabled();
  });

  it('manages its members', async () => {
    await openSettings(settingsList());

    fireEvent.press(screen.getByText(t('shoppingListScreens.manageMembers')));

    expect(mockNav.toShareList).toHaveBeenCalledWith({ listId: 'sl1' });
  });

  it('offers no way to leave its own list', async () => {
    await openSettings(settingsList());

    expect(screen.queryByText(t('labels.leaveList'))).not.toBeOnTheScreen();
  });

  it('is deleted once confirmed, and the screen goes back', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    const removal = recordMock(DeleteShoppingListDocument, {
      data: {
        deleteShoppingList: { __typename: 'DeleteShoppingListPayload' },
      },
    });
    await openSettings(settingsList(), [removal]);

    fireEvent.press(screen.getByText(t('labels.deleteList')));
    answerAlert(t('labels.delete'));
    await log.landed(DeleteShoppingListDocument);

    expect(removal.fired[0]).toMatchObject({ input: { id: 'sl1' } });
    expect(useStore.getState().selectedShoppingListId).toBeNull();
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  // The offline queue resolves a write it takes with no payload.
  it('is deleted offline, the delete queued, and the screen goes back', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    await openSettings(settingsList(), [
      recordMock(DeleteShoppingListDocument, {
        data: { deleteShoppingList: null },
      }),
    ]);

    fireEvent.press(screen.getByText(t('labels.deleteList')));
    answerAlert(t('labels.delete'));
    await log.landed(DeleteShoppingListDocument);

    expect(useStore.getState().selectedShoppingListId).toBeNull();
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('stays when the delete is refused', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    await openSettings(settingsList(), [
      recordMock(DeleteShoppingListDocument, {
        data: {
          deleteShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'Not yours',
          },
        },
      }),
    ]);

    fireEvent.press(screen.getByText(t('labels.deleteList')));
    answerAlert(t('labels.delete'));
    await log.landed(DeleteShoppingListDocument);

    expect(useStore.getState().selectedShoppingListId).toBe('sl1');
    expect(goBack).not.toHaveBeenCalled();
  });
});

describe('its status', () => {
  it('is marked done, and a done list active again', async () => {
    const complete = recordMock(CompleteShoppingListDocument, { held: true });
    await openSettings(settingsList(), [complete]);

    fireEvent.press(screen.getByText(t('shoppingListScreens.markComplete')));
    await log.requested(CompleteShoppingListDocument);

    expect(complete.fired[0]).toMatchObject({ input: { id: 'sl1' } });
  });

  it('is made active again once done', async () => {
    const reactivate = recordMock(MarkShoppingListActiveDocument, {
      held: true,
    });
    await openSettings(
      settingsList({ status: ListStatus.Completed, isCompleted: true }),
      [reactivate],
    );

    fireEvent.press(screen.getByText(t('shoppingListScreens.reactivateList')));
    await log.requested(MarkShoppingListActiveDocument);

    expect(reactivate.fired[0]).toMatchObject({ input: { id: 'sl1' } });
  });

  it('is archived once confirmed', async () => {
    const update = recordMock(UpdateShoppingListDocument, { held: true });
    await openSettings(settingsList(), [update]);

    fireEvent.press(screen.getByText(t('labels.archiveList')));
    expect(update.fired).toEqual([]);
    answerAlert(t('labels.archiveList'));
    await log.requested(UpdateShoppingListDocument);

    expect(update.fired[0]).toMatchObject({
      input: { status: ListStatus.Archived },
    });
  });

  it('is restored from the archive at once', async () => {
    const update = recordMock(UpdateShoppingListDocument, { held: true });
    await openSettings(settingsList({ status: ListStatus.Archived }), [update]);

    fireEvent.press(screen.getByText(t('shoppingListScreens.restoreList')));
    await log.requested(UpdateShoppingListDocument);

    expect(update.fired[0]).toMatchObject({
      input: { status: ListStatus.Active },
    });
  });
});

describe('its repeats, reminder and template', () => {
  it('repeats on the pattern picked, every time', async () => {
    const repeat = recordMock(CreateRecurringShoppingListDocument, {
      held: true,
    });
    await openSettings(settingsList(), [repeat]);

    fireEvent.press(screen.getByText(t('shoppingListScreens.makeRecurring')));
    fireEvent.press(screen.getByText(t('shoppingListScreens.patternWeekly')));
    await log.requested(CreateRecurringShoppingListDocument);

    expect(repeat.fired[0]).toMatchObject({
      input: {
        id: 'sl1',
        recurringPattern: RecurringPattern.Weekly,
        recurringInterval: 1,
      },
    });
  });

  it('stops repeating', async () => {
    const stop = recordMock(CancelRecurringDocument, { held: true });
    await openSettings(
      settingsList({
        isRecurring: true,
        recurringPattern: RecurringPattern.Weekly,
      }),
      [stop],
    );

    fireEvent.press(screen.getByText(t('shoppingListScreens.stopRecurring')));
    await log.requested(CancelRecurringDocument);

    expect(stop.fired[0]).toMatchObject({ input: { id: 'sl1' } });
  });

  // The reminder already set opens the calendar on its month.
  it('reminds on the day picked, at its noon', async () => {
    const remind = recordMock(UpdateShoppingListReminderDocument, {
      held: true,
    });
    await openSettings(
      settingsList({
        reminderEnabled: true,
        reminderDate: new Date(2099, 5, 10, 12).toISOString(),
      }),
      [remind],
    );

    fireEvent.press(
      screen.getByText(formatMonthDayYear(new Date(2099, 5, 10))),
    );
    fireEvent.press(screen.getByText('20'));
    await log.requested(UpdateShoppingListReminderDocument);

    expect(remind.fired[0]).toMatchObject({
      input: { reminderDate: new Date(2099, 5, 20, 12).toISOString() },
    });
  });

  it('clears its reminder', async () => {
    const clear = recordMock(DeleteShoppingListReminderDocument, {
      held: true,
    });
    await openSettings(
      settingsList({
        reminderEnabled: true,
        reminderDate: new Date(2099, 5, 10, 12).toISOString(),
      }),
      [clear],
    );

    fireEvent.press(screen.getByText(t('shoppingListScreens.clearReminder')));
    await log.requested(DeleteShoppingListReminderDocument);

    expect(clear.fired[0]).toMatchObject({ input: { id: 'sl1' } });
  });

  it('makes a list from itself as a template, and opens it', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    const create = createAnswer();
    await openSettings(
      settingsList({ isTemplate: true, templateName: 'Weekly' }),
      [create],
      cachedForCopy(),
    );

    fireEvent.press(
      screen.getByText(t('shoppingListScreens.createFromTemplate')),
    );
    await log.landed(CreateShoppingListDocument);

    const [sent] = create.fired;
    if (!sent) throw new Error('nothing was created');
    expect(useStore.getState().selectedShoppingListId).toBe(inputOf(sent).id);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('makes its next list, and opens it', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    const create = createAnswer();
    const advance = recordMock(CreateRecurringShoppingListDocument, {
      data: {
        createRecurringShoppingList: {
          __typename: 'CreateRecurringShoppingListPayload',
        },
      },
    });
    await openSettings(
      settingsList({
        isRecurring: true,
        recurringPattern: RecurringPattern.Weekly,
        recurringInterval: 1,
        nextRecurringDate: new Date(2099, 5, 10, 12).toISOString(),
      }),
      [create, advance],
      cachedForCopy(),
    );

    fireEvent.press(
      screen.getByText(t('shoppingListScreens.generateNextList')),
    );
    await log.landed(CreateRecurringShoppingListDocument);

    const [sent] = create.fired;
    if (!sent) throw new Error('nothing was created');
    expect(useStore.getState().selectedShoppingListId).toBe(inputOf(sent).id);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('is saved as a template under its name', async () => {
    const mark = recordMock(MarkAsTemplateDocument, { held: true });
    await openSettings(settingsList(), [mark]);

    fireEvent.press(screen.getByText(t('labels.saveAsTemplate')));
    await log.requested(MarkAsTemplateDocument);

    expect(mark.fired[0]).toMatchObject({
      input: { id: 'sl1', templateName: 'Weekly Groceries' },
    });
  });
});

describe('a list someone else owns', () => {
  it('shows a viewer its details, read-only', async () => {
    await openSettings(
      settingsList({
        ownerships: [ownedBy(OTHER_ID)],
        collaboratorsConnection: collaboratorsOf(
          listCollaborator(USER_ID),
          listCollaborator('u3'),
        ),
      }),
    );

    expect(screen.getByText(t('shoppingListScreens.listInfo'))).toBeTruthy();
    expect(screen.queryByText(t('labels.save'))).not.toBeOnTheScreen();
    expect(
      screen.queryByDisplayValue('Weekly Groceries'),
    ).not.toBeOnTheScreen();
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText(t('collaboratorRoles.viewer'))).toBeTruthy();
    expect(
      screen.getByText(t('labels.memberCount', { count: 2 })),
    ).toBeTruthy();
    expect(
      screen.queryByText(t('shoppingListScreens.manageMembers')),
    ).not.toBeOnTheScreen();
  });

  it('lets a collaborator who may edit change it, but not its default', async () => {
    await openSettings(
      settingsList({
        ownerships: [ownedBy(OTHER_ID)],
        collaboratorsConnection: collaboratorsOf(
          listCollaborator(USER_ID, {
            role: CollaboratorRole.Editor,
            canEdit: true,
          }),
        ),
      }),
    );

    expect(screen.getByDisplayValue('Weekly Groceries')).toBeTruthy();
    expect(save()).toBeTruthy();
    expect(
      screen.queryByLabelText(t('shoppingListScreens.defaultList')),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText(t('labels.deleteList'))).not.toBeOnTheScreen();
  });

  it('lets a collaborator leave once confirmed, and the screen goes back', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    const leave = recordMock(RemoveCollaboratorDocument, {
      data: {
        removeShoppingListCollaborator: {
          __typename: 'RemoveShoppingListCollaboratorPayload',
        },
      },
    });
    await openSettings(
      settingsList({
        ownerships: [ownedBy(OTHER_ID)],
        collaboratorsConnection: collaboratorsOf(listCollaborator(USER_ID)),
      }),
      [leave],
    );

    // The section's title reads the same.
    const [, leaveButton] = screen.getAllByText(t('labels.leaveList'));
    if (!leaveButton) throw new Error('no Leave List button');
    fireEvent.press(leaveButton);
    answerAlert(t('labels.leaveList'));
    await log.landed(RemoveCollaboratorDocument);

    expect(leave.fired[0]).toMatchObject({ input: { id: `c-${USER_ID}` } });
    expect(useStore.getState().selectedShoppingListId).toBeNull();
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  // A row left from before the list joined a home must not dead-end them.
  it('lets a collaborator leave a list since put in a home they are not in', async () => {
    await openSettings(
      settingsList({
        homeId: 'h1',
        home: {
          __typename: 'Home',
          id: 'h1',
          name: 'Family',
          myMembership: null,
        },
        ownerships: [ownedBy(OTHER_ID)],
        collaboratorsConnection: collaboratorsOf(listCollaborator(USER_ID)),
      }),
    );

    expect(
      screen.queryByText(t('shoppingListScreens.manageHome')),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByText(t('shoppingListScreens.leaveDescription')),
    ).toBeTruthy();
  });

  it('tells a home member to manage the home rather than leave', async () => {
    await openSettings(homeList(MembershipRole.Member));

    expect(
      screen.getByText(
        t('shoppingListScreens.cantLeaveHomeLinkedMessage', { name: 'Family' }),
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByText(t('shoppingListScreens.manageHome')));

    expect(mockNav.toHomeDetail).toHaveBeenCalledWith({ homeId: 'h1' });
  });

  it('lets a home member edit it, but delete it only as an admin', async () => {
    await openSettings(homeList(MembershipRole.Member));

    expect(screen.getByDisplayValue('Weekly Groceries')).toBeTruthy();
    expect(screen.queryByText(t('labels.deleteList'))).not.toBeOnTheScreen();
  });

  it('lets a home admin delete it', async () => {
    await openSettings(homeList(MembershipRole.Admin));

    expect(screen.getByText(t('labels.deleteList'))).toBeTruthy();
  });

  // A collaborator row missing its email is never taken for the person.
  it('goes back, letting go of the list, once the person no longer reaches it', async () => {
    useStore.setState({ user: { ...person, email: null } });
    const goBack = jest.spyOn(memoryIntents(), 'goBack');

    await openSettings(
      settingsList({
        ownerships: [ownedBy(OTHER_ID)],
        collaboratorsConnection: collaboratorsOf(
          listCollaborator('u3', { email: null }),
        ),
      }),
    );

    expect(goBack).toHaveBeenCalled();
    expect(useStore.getState().selectedShoppingListId).toBeNull();
  });
});

describe('while the list is unknown', () => {
  it('waits, rather than show the viewer screen', async () => {
    renderWithApollo(<ListSettings route={{ params: { listId: 'sl1' } }} />, {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [listDetailsRead(settingsList(), { held: true }).mock],
    });
    await log.requested(GetShoppingListDetailsDocument);

    expect(
      screen.queryByText(t('shoppingListScreens.listInfo')),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText(t('labels.save'))).not.toBeOnTheScreen();
  });

  it('says the list could not be read, and reads it again on a retry', async () => {
    renderWithApollo(<ListSettings route={{ params: { listId: 'sl1' } }} />, {
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
});

describe('a new list', () => {
  it('is created, offering a home and no sharing, leaving or deleting', async () => {
    await openNewList();

    expect(
      screen.getByText(t('shoppingListScreens.createNewList')),
    ).toBeTruthy();
    expect(screen.getByText(t('labels.create'))).toBeTruthy();
    expect(
      screen.getByText(t('shoppingListScreens.personalNoHome')),
    ).toBeTruthy();
    expect(
      screen.queryByText(t('shoppingListScreens.manageMembers')),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText(t('labels.leaveList'))).not.toBeOnTheScreen();
    expect(screen.queryByText(t('labels.deleteList'))).not.toBeOnTheScreen();
  });

  it('is made in the home picked, trimmed and default, and opened', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    const homes = recordMock(GetHomesDocument, {
      data: {
        homes: {
          __typename: 'HomeConnection',
          edges: [
            {
              __typename: 'HomeEdge',
              cursor: 'h1',
              node: { __typename: 'Home', id: 'h1', name: 'Family' },
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });
    const create = createAnswer();
    await openNewList([homes, create]);

    fireEvent.press(screen.getByText(t('shoppingListScreens.personalNoHome')));
    await log.landed(GetHomesDocument);
    fireEvent.press(screen.getByText('Family'));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('shoppingListScreens.listNamePlaceholder')),
      '  Party  ',
    );
    fireEvent(
      screen.getByLabelText(t('shoppingListScreens.defaultList')),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByText(t('labels.create')));
    await log.landed(CreateShoppingListDocument);

    const [sent] = create.fired;
    if (!sent) throw new Error('nothing was created');
    expect(inputOf(sent)).toMatchObject({
      name: 'Party',
      homeId: 'h1',
      isDefault: true,
    });
    expect(useStore.getState().selectedShoppingListId).toBe(inputOf(sent).id);
    expect(goBack).toHaveBeenCalled();
  });

  it('stays, saying why, when the create is refused', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    await openNewList([
      recordMock(CreateShoppingListDocument, {
        data: {
          createShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'Not allowed',
          },
        },
      }),
    ]);

    fireEvent.changeText(
      screen.getByPlaceholderText(t('shoppingListScreens.listNamePlaceholder')),
      'Party',
    );
    fireEvent.press(screen.getByText(t('labels.create')));
    await log.landed(CreateShoppingListDocument);

    expect(toastService.error).toHaveBeenCalledWith(
      t('errors.codes.forbidden'),
    );
    expect(goBack).not.toHaveBeenCalled();
  });

  it('names the home picked, and goes back to none', async () => {
    const homes = recordMock(GetHomesDocument, {
      data: {
        homes: {
          __typename: 'HomeConnection',
          edges: [
            {
              __typename: 'HomeEdge',
              cursor: 'h1',
              node: { __typename: 'Home', id: 'h1', name: 'Family' },
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });
    const create = createAnswer();
    await openNewList([homes, create]);

    fireEvent.press(screen.getByText(t('shoppingListScreens.personalNoHome')));
    await log.landed(GetHomesDocument);
    fireEvent.press(screen.getByText('Family'));
    await act(() => Promise.resolve());
    expect(screen.getAllByText('Family')).toHaveLength(1);

    fireEvent.press(screen.getByText('Family'));
    fireEvent.press(screen.getByText(t('shoppingListScreens.personalNoHome')));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('shoppingListScreens.listNamePlaceholder')),
      'Party',
    );
    fireEvent.press(screen.getByText(t('labels.create')));
    await log.landed(CreateShoppingListDocument);

    const [sent] = create.fired;
    if (!sent) throw new Error('nothing was created');
    expect(inputOf(sent).homeId).toBeUndefined();
  });

  it('says so when the homes cannot be read', async () => {
    await openNewList([
      recordMock(GetHomesDocument, {
        error: new Error('Network request failed'),
      }),
    ]);

    fireEvent.press(screen.getByText(t('shoppingListScreens.personalNoHome')));
    await log.landed(GetHomesDocument);

    expect(screen.getByTestId('state-error')).toBeTruthy();
  });
});

describe('a new list from a saved template', () => {
  const STAPLES: Template = { id: 'tpl1', name: 'Weekly Staples' };
  const PARTY: Template = { id: 'tpl2', name: 'Party Supplies' };

  it('offers none without saved templates', async () => {
    await openNewList([], []);

    expect(
      screen.queryByText(t('shoppingListScreens.startFromTemplate')),
    ).not.toBeOnTheScreen();
  });

  it('is never offered on an existing list, which reads no templates', async () => {
    const templates = templatesRead([STAPLES]);
    await openSettings(settingsList(), [templates]);

    expect(
      screen.queryByText(t('shoppingListScreens.startFromTemplate')),
    ).not.toBeOnTheScreen();
    expect(templates.fired).toEqual([]);
  });

  it('is named after the template picked, unless a name was typed', async () => {
    await openNewList([], [STAPLES, PARTY]);
    const name = () =>
      screen.getByPlaceholderText(t('shoppingListScreens.listNamePlaceholder'));

    fireEvent.press(
      screen.getByText(t('shoppingListScreens.noTemplateBlankList')),
    );
    fireEvent.press(screen.getByText('Weekly Staples'));
    await act(() => Promise.resolve());
    expect(name().props.value).toBe('Weekly Staples');

    fireEvent.changeText(name(), 'Saturday');
    fireEvent.press(screen.getByText('Weekly Staples'));
    await act(() => Promise.resolve());
    fireEvent.press(screen.getByText('Party Supplies'));
    expect(name().props.value).toBe('Saturday');
  });

  it('is copied into the home picked, made default, and opened', async () => {
    const goBack = jest.spyOn(memoryIntents(), 'goBack');
    const homes = recordMock(GetHomesDocument, {
      data: {
        homes: {
          __typename: 'HomeConnection',
          edges: [
            {
              __typename: 'HomeEdge',
              cursor: 'h1',
              node: { __typename: 'Home', id: 'h1', name: 'Family' },
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });
    const create = createAnswer();
    const markDefault = recordMock(MarkShoppingListAsDefaultDocument, {
      data: {
        markShoppingListAsDefault: {
          __typename: 'MarkShoppingListAsDefaultPayload',
        },
      },
    });
    await openNewList([homes, create, markDefault], [STAPLES]);

    fireEvent.press(
      screen.getByText(t('shoppingListScreens.noTemplateBlankList')),
    );
    fireEvent.press(screen.getByText('Weekly Staples'));
    await act(() => Promise.resolve());
    fireEvent.press(screen.getByText(t('shoppingListScreens.personalNoHome')));
    await log.landed(GetHomesDocument);
    fireEvent.press(screen.getByText('Family'));
    fireEvent(
      screen.getByLabelText(t('shoppingListScreens.defaultList')),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByText(t('labels.create')));
    await log.landed(MarkShoppingListAsDefaultDocument);

    const [sent] = create.fired;
    if (!sent) throw new Error('nothing was created');
    expect(inputOf(sent)).toMatchObject({
      name: 'Weekly Staples',
      homeId: 'h1',
    });
    const newId = inputOf(sent).id;
    expect(markDefault.fired[0]).toMatchObject({ input: { id: newId } });
    expect(useStore.getState().selectedShoppingListId).toBe(newId);
    expect(goBack).toHaveBeenCalled();
  });
});

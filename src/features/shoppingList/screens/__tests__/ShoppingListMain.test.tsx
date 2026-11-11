import React, { useEffect } from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { screenShows, withDeadline } from '#/test-utils/cacheWaits';
import {
  homeShoppingList,
  listDetailsRead,
  listLine,
  listLinesRead,
  listsRead,
  ownShoppingList,
  type ListLine,
  type ShoppingListNode,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { markFeatureHintShown } from '#hooks/settings/useFeatureHint';
import {
  startTutorialSession,
  tutorialSession,
} from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';
import { kitTestIDs } from '#components/testIDs';
import { Telemetry } from '#services/telemetry';
import { FIRST_SHOP_STEP } from '#features/shoppingList/context/useFirstShopTour';
import {
  TabBarActionsProvider,
  useTabBarSetters,
  useTabBarState,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import {
  AddItemToShoppingListDocument,
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListSuggestionsDocument,
  GetShoppingListsLiteDocument,
  RemoveItemFromShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { MoveToPantryPurchaseInfoDocument } from '#features/shoppingList/components/moveToPantry/MoveToPantryModal.generated';
import { GetHomesDocument } from '#operations/home/home.generated';
import {
  AutocompleteItemsDocument,
  SearchItemsSemanticDocument,
} from '#operations/item/item.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { ShoppingListMain } from '../ShoppingListMain';

jest.mock('#hooks/navigation/useAppNavigation');
// Navigation is the boundary: there is no navigator, so the screen counts as
// focused while mounted, on the route the test gives it.
const mockRoute: { params: Record<string, unknown> } = { params: {} };
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
    useIsFocused: () => true,
    useRoute: () => mockRoute,
  };
});
// Jest lays nothing out, so a measured target reports a fixed rect.
jest.mock('#hooks/ui/useMeasuredRect', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    useMeasuredRect: (
      onMeasure?: (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void,
    ) => {
      useMountEffect(() => {
        onMeasure?.({ x: 16, y: 60, width: 140, height: 28 });
      }, [onMeasure]);
      return { ref: { current: null }, measure: () => undefined };
    },
  };
});

// A skeleton's minimum time on screen is a clock, held by its own test: here
// it goes as soon as the list has painted, not 280 ms later.
jest.mock('#features/shoppingList/hooks/useMinimumVisible', () => ({
  useMinimumVisible: (active: boolean) => active,
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const USER_ID = 'user-1';
const member = {
  id: USER_ID,
  email: 'member@example.com',
  emailVerified: true,
  onBoarded: true,
};

const GROCERIES = homeShoppingList('list-1', 'Groceries');
const WEEKEND = homeShoppingList('list-2', 'Weekend');

/** What the shell's tab bar reads from the screen. */
const shell: {
  addMenu?: readonly TabBarAddAction[];
  menuOpen?: boolean;
  scan?: () => void;
} = {};

/** Stands where FloatingTabBar does: marks the tab active, places +, reads it. */
function TabBar() {
  const { setActiveTab, setAddButtonRect } = useTabBarSetters();
  const { addMenu, isAddMenuOpen, onScanPress } = useTabBarState();
  useEffect(() => {
    setActiveTab('ShoppingList');
    setAddButtonRect({ x: 300, y: 760, width: 56, height: 56 });
  }, [setActiveTab, setAddButtonRect]);
  useEffect(() => {
    shell.addMenu = addMenu;
    shell.menuOpen = isAddMenuOpen;
    shell.scan = onScanPress;
  });
  return null;
}

/** Runs a row's swipe action, as a screen reader offers it. */
const rowAction = (lineId: string, actionName: string) =>
  fireEvent(
    screen.getByTestId(shoppingListTestIDs.itemRow(lineId)),
    'accessibilityAction',
    { nativeEvent: { actionName } },
  );

const menuEntry = (key: string) =>
  shell.addMenu?.find(action => action.key === key);

/** The control labelled `label` nearest `inside`, as a sheet's Save beside its title. */
function controlNear(
  inside: ReturnType<typeof screen.getByText>,
  label: string,
) {
  for (let node = inside.parent; node; node = node.parent) {
    const [control] = within(node).queryAllByLabelText(label);
    if (control) return control;
  }
  throw new Error(`nothing labelled ${label} near the element given`);
}

const purchasedTab = () =>
  screen.getByTestId(
    kitTestIDs.filterTab(shoppingListTestIDs.tabBarPrefix, 'purchased'),
  );

/**
 * Jest renders a closed sheet's content too, so a sheet is open when it asks
 * for what only an open one reads: the add sheet its suggestions, the move
 * sheet the line's purchase.
 */
const addSheetOpened = () => log.requested(GetShoppingListSuggestionsDocument);
const moveSheetOpened = () => log.requested(MoveToPantryPurchaseInfoDocument);

/** The reads a move sheet makes on opening, left unanswered. */
const moveSheetReads = () => [
  recordMock(GetHomesDocument, { held: true }),
  recordMock(MoveToPantryPurchaseInfoDocument, { held: true }),
];

let log = operationLog();

/** Resolves when a tour shows the step, the signal its spotlight is up. */
const stepViewed = (featureId: string) =>
  withDeadline(
    done => {
      jest.spyOn(Telemetry, 'trackEvent').mockImplementation((name, props) => {
        if (name === 'tour_step_viewed' && props?.feature_id === featureId) {
          done();
        }
      });
      return () => undefined;
    },
    () => `the tour never showed ${featureId}`,
  );

interface Visit {
  lists?: ShoppingListNode[];
  lines?: ListLine[];
  /**
   * The list's detail read; `null` fails it (as `errorPolicy: 'ignore'` hides
   * a failure) once the lines are in, and `'held'` keeps it coming.
   */
  details?: ShoppingListNode | null | 'held';
  /** The lines cannot be read. */
  linesFail?: boolean;
  /** The lists come only once the test releases them. */
  holdLists?: boolean;
  /** Answers ahead of the ones every visit gets. */
  answers?: ReturnType<typeof recordMock>[];
  /** The list the device last showed. */
  selected?: string | null;
}

/** The list tab as HomeTabs mounts it, its reads answered. */
async function openListTab({
  lists = [GROCERIES, WEEKEND],
  lines = [],
  details = lists[0] ?? null,
  linesFail = false,
  holdLists = false,
  selected = lists[0]?.id ?? null,
  answers = [],
}: Visit = {}) {
  useStore.setState({ selectedShoppingListId: selected });
  // A failed read holding nothing is asked again when another read writes the
  // list, so each failure is held until the other reads are in.
  const detailRead =
    details === null
      ? recordMock(GetShoppingListDetailsDocument, {
          error: new Error('Network request failed'),
          held: true,
        })
      : listDetailsRead(details === 'held' ? GROCERIES : details, {
          held: details === 'held',
        });
  const linesRead = linesFail
    ? recordMock(GetShoppingListItemsFilteredDocument, {
        error: new Error('Network request failed'),
        held: true,
      })
    : listLinesRead(lists[0]?.id ?? 'list-1', lines);
  const listsAnswer = listsRead(lists, { held: holdLists });
  const cache = makeCache();
  const view = renderWithApollo(
    <TabBarActionsProvider>
      <TabBar />
      <ShoppingListMain />
    </TabBarActionsProvider>,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        listsAnswer.mock,
        detailRead.mock,
        linesRead.mock,
        // An open add sheet asks for suggestions; a test that needs them
        // answers them ahead of this.
        recordMock(GetShoppingListSuggestionsDocument, { held: true }).mock,
      ],
    },
  );
  if (!holdLists) await log.landed(GetShoppingListsLiteDocument);
  if (lists.length > 0 && linesFail) {
    await log.landed(GetShoppingListDetailsDocument);
    linesRead.release();
    await log.landed(GetShoppingListItemsFilteredDocument);
  } else if (lists.length > 0) {
    // To buy, then bought: the second page waits for the first.
    await log.landed(GetShoppingListItemsFilteredDocument, 2);
    if (details === null) detailRead.release();
    if (details !== 'held') await log.landed(GetShoppingListDetailsDocument);
  }
  return { ...view, cache, releaseLists: listsAnswer.release };
}

const MILK = listLine('line-1', 'Milk');
const EGGS = listLine('line-2', 'Eggs');
const BREAD = listLine('line-3', 'Bread');
const BOUGHT_OATS = listLine('line-9', 'Oats', { bought: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute.params = {};
  shell.addMenu = undefined;
  shell.menuOpen = undefined;
  shell.scan = undefined;
  log = operationLog();
  useStore.setState({
    user: member,
    selectedShoppingListId: 'list-1',
    isOnline: true,
    apiReachable: true,
    storeMode: false,
    budgetAndPrices: false,
    // Tips on, none seen yet, and no tip shown unasked yet.
    showTutorials: true,
    featureHintsShown: {},
    lastUnpromptedTipAt: {},
  });
  // A guide finished before: the list's tips wait to be asked for.
  markFeatureHintShown('shopping_interactive_tutorial', USER_ID);
  // The + menu belongs to the tab navigation says is focused.
  mockNav.navigation.getState.mockReturnValue({
    type: 'tab',
    index: 0,
    routes: [{ name: 'ShoppingList' }],
  });
  tutorialSession.endGuide(GUIDE_TOURS.shop);
  // A session shows one tip unasked; each test is a session of its own.
  startTutorialSession();
});

describe('a list', () => {
  it('is named in the header, and shows its lines', async () => {
    await openListTab({ lines: [MILK, EGGS] });

    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByLabelText('Milk')).toBeTruthy();
    expect(screen.getByLabelText('Eggs')).toBeTruthy();
  });

  it('is switched from the header', async () => {
    await openListTab();
    const user = userEvent.setup();

    await user.press(
      screen.getByTestId(shoppingListTestIDs.listSelectorButton),
    );
    await user.press(screen.getByText('Weekend'));

    expect(useStore.getState().selectedShoppingListId).toBe('list-2');
  });

  // The device remembers which list it showed, so its lines can come first.
  it('keeps its lines on screen while the lists are still coming', async () => {
    await openListTab({ lines: [MILK, EGGS], holdLists: true });

    expect(screen.getByLabelText('Milk')).toBeTruthy();
  });

  it('acts on its lines while the lists are still coming', async () => {
    await openListTab({ lines: [MILK], holdLists: true });

    fireEvent.press(screen.getByTestId(shoppingListTestIDs.itemRow('line-1')));
    act(() => menuEntry('search')?.onPress());

    expect(mockNav.toShoppingListItemDetail).toHaveBeenCalledWith({
      listId: 'list-1',
      itemId: 'line-1',
    });
    await expect(addSheetOpened()).resolves.toBeUndefined();
  });

  it('is opened on the list a link names', async () => {
    mockRoute.params = { listId: 'list-2' };

    await openListTab();

    expect(useStore.getState().selectedShoppingListId).toBe('list-2');
  });

  it('searches its lines', async () => {
    await openListTab({ lines: [MILK, EGGS] });

    await userEvent
      .setup()
      .type(screen.getByTestId(shoppingListTestIDs.searchInput), 'Mil');

    expect(screen.getByLabelText('Milk')).toBeTruthy();
    expect(screen.queryByLabelText('Eggs')).not.toBeOnTheScreen();
  });
});

describe('a line', () => {
  it('is ticked by its checkbox', async () => {
    const tick = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openListTab({ lines: [MILK], answers: [tick] });

    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.itemCheckbox('line-1')),
    );
    await log.requested(UpdateShoppingListItemDocument);

    expect(tick.fired[0]).toMatchObject({
      input: { id: 'line-1', purchaseTracking: { isPurchased: true } },
    });
  });

  it('records what was bought from a long-press, ticking nothing first', async () => {
    const purchase = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openListTab({
      lines: [listLine('line-1', 'Milk', { quantity: 2 })],
      answers: [purchase],
    });

    fireEvent(
      screen.getByTestId(shoppingListTestIDs.itemRow('line-1')),
      'longPress',
    );
    const quantity = screen.getByTestId(
      shoppingListTestIDs.purchaseQuantityInput,
    );
    // Seeded from the line only once its sheet opens.
    expect(quantity.props.value).toBe('2');
    fireEvent.changeText(quantity, '3');
    fireEvent.press(
      controlNear(
        screen.getByText(t('purchaseAmountSheet.title')),
        t('labels.save'),
      ),
    );
    await log.requested(UpdateShoppingListItemDocument);

    expect(purchase.fired[0]).toMatchObject({
      input: {
        id: 'line-1',
        purchaseTracking: { isPurchased: true, purchasedQuantity: 3 },
      },
    });
  });

  it('opens its detail', async () => {
    await openListTab({ lines: [MILK] });

    fireEvent.press(screen.getByTestId(shoppingListTestIDs.itemRow('line-1')));

    expect(mockNav.toShoppingListItemDetail).toHaveBeenCalledWith({
      listId: 'list-1',
      itemId: 'line-1',
    });
  });

  it('opens its edit from its swipe', async () => {
    await openListTab({ lines: [MILK] });

    rowAction('line-1', 'edit');

    expect(mockNav.toEditItem).toHaveBeenCalledWith({
      listId: 'list-1',
      itemId: 'line-1',
    });
  });

  it('is removed from its swipe', async () => {
    const removal = recordMock(RemoveItemFromShoppingListDocument, {
      held: true,
    });
    await openListTab({ lines: [MILK], answers: [removal] });

    rowAction('line-1', 'delete');
    await log.requested(RemoveItemFromShoppingListDocument);

    expect(removal.fired[0]).toMatchObject({ input: { id: 'line-1' } });
  });
});

describe('the bought lines', () => {
  it('put a line away into a pantry', async () => {
    await openListTab({ lines: [BOUGHT_OATS], answers: moveSheetReads() });
    fireEvent.press(purchasedTab());

    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.itemMoveToPantry('line-9')),
    );

    await expect(moveSheetOpened()).resolves.toBeUndefined();
  });

  // Only a list in a home has a pantry to move to.
  it.each([
    ['in a home', GROCERIES, true],
    ['of the person’s own', ownShoppingList('list-1', 'Groceries'), false],
  ])('are moved all at once from a list %s', async (_, list, offered) => {
    await openListTab({ lists: [list], lines: [BOUGHT_OATS] });

    fireEvent.press(purchasedTab());

    expect(
      screen.queryByTestId(shoppingListTestIDs.batchMoveToPantryButton) !==
        null,
    ).toBe(offered);
  });

  it('stay listed when the bought ones cannot be read', async () => {
    const boughtFail = recordMock(GetShoppingListItemsFilteredDocument, {
      error: new Error('Network request failed'),
      match: variables => variables.isPurchased === true,
    });
    await openListTab({ lines: [MILK], answers: [boughtFail] });

    expect(screen.getByLabelText('Milk')).toBeTruthy();
    expect(screen.queryByTestId('state-error')).not.toBeOnTheScreen();
  });
});

describe('the header', () => {
  it('offers neither store mode nor budget & prices until they are turned on', async () => {
    await openListTab();

    expect(
      screen.queryByTestId(shoppingListTestIDs.storeModeButton),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByTestId(shoppingListTestIDs.budgetAndPricesButton),
    ).not.toBeOnTheScreen();
  });

  it('opens store mode and budget & prices on the list on screen', async () => {
    useStore.setState({ storeMode: true, budgetAndPrices: true });
    await openListTab();

    fireEvent.press(screen.getByTestId(shoppingListTestIDs.storeModeButton));
    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.budgetAndPricesButton),
    );

    expect(mockNav.toStoreMode).toHaveBeenCalledWith({ listId: 'list-1' });
    expect(mockNav.toListBudget).toHaveBeenCalledWith({ listId: 'list-1' });
  });
});

describe('the + menu', () => {
  it('offers search, barcode and manual adds for the list on screen', async () => {
    await openListTab();

    expect(shell.addMenu?.map(action => action.key)).toEqual([
      'search',
      'barcode',
      'manual',
    ]);
    act(() => menuEntry('barcode')?.onPress());
    expect(mockNav.toBarcode).toHaveBeenCalledWith({
      source: 'shoppingList',
      shoppingListId: 'list-1',
    });
  });

  it('opens the search add', async () => {
    await openListTab();

    act(() => menuEntry('search')?.onPress());

    await expect(addSheetOpened()).resolves.toBeUndefined();
  });

  it('opens the manual add on its form', async () => {
    await openListTab();

    act(() => menuEntry('manual')?.onPress());
    await addSheetOpened();

    expect(
      screen.getByTestId(shoppingListTestIDs.addSheetNameInput),
    ).toBeTruthy();
  });

  it('searches the catalog for the list’s search, and clears it on an add', async () => {
    const catalog = recordMock(AutocompleteItemsDocument, {
      data: {
        autocompleteItems: {
          __typename: 'AutocompleteResult',
          suggestions: [
            { __typename: 'ItemSuggestion', id: 'item-milk', name: 'Milk' },
          ],
        },
      },
    });
    const add = recordMock(AddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [{ success: true, item: { id: 'line-milk' } }],
        },
      },
    });
    // The search the typing pauses for, left unanswered.
    const meaning = recordMock(SearchItemsSemanticDocument, { held: true });
    const { client } = await openListTab({
      lines: [EGGS],
      answers: [catalog, add, meaning],
    });
    const search = screen.getByTestId(shoppingListTestIDs.searchInput);
    await userEvent.setup().type(search, 'Mil');

    act(() => menuEntry('search')?.onPress());
    await addSheetOpened();
    const matches = {
      query: AutocompleteItemsDocument,
      variables: { input: { query: 'Mil', limit: 10 } },
    };
    await act(() =>
      screenShows(
        client,
        matches,
        () => client.readQuery(matches)?.autocompleteItems.suggestions,
        found => !!found?.length,
      ),
    );
    fireEvent.press(
      screen.getByLabelText(t('a11y.quickAdd', { name: 'Milk' })),
    );
    await log.landed(AddItemToShoppingListDocument);

    expect(catalog.fired).toContainEqual({
      input: expect.objectContaining({ query: 'Mil' }),
    });
    expect(search.props.value).toBe('');
  });

  it('offers only a new list with no list to add to', async () => {
    await openListTab({ lists: [] });

    expect(shell.addMenu?.map(action => action.key)).toEqual(['createList']);
    act(() => menuEntry('createList')?.onPress());
    expect(mockNav.toListSettings).toHaveBeenCalled();
  });

  it('opens from an empty list’s Add item', async () => {
    await openListTab();

    fireEvent.press(screen.getByText(t('labels.addItem')));

    expect(shell.menuOpen).toBe(true);
  });

  it('says why a guest may not add', async () => {
    const guest = homeShoppingList('list-1', 'Groceries', {
      role: MembershipRole.Guest,
    });
    await openListTab({ lists: [guest, WEEKEND] });

    expect(menuEntry('search')).toMatchObject({
      disabledReason: t('shoppingListScreen.noAddPermission'),
      pending: false,
    });
  });

  it('scans a barcode onto the list from the tab bar', async () => {
    await openListTab();

    act(() => shell.scan?.());

    expect(mockNav.toBarcode).toHaveBeenCalledWith({
      source: 'shoppingList',
      shoppingListId: 'list-1',
    });
  });
});

describe('with no lists', () => {
  it('offers to create one', async () => {
    await openListTab({ lists: [] });

    fireEvent.press(screen.getByText(t('shoppingListScreen.noListsAction')));

    expect(mockNav.toListSettings).toHaveBeenCalled();
  });

  // After a failure the app does not know whether lists exist.
  it('offers a retry when the lists cannot be read, never a new list', async () => {
    await openListTab({
      lists: [],
      answers: [
        recordMock(GetShoppingListsLiteDocument, {
          error: new Error('Network request failed'),
        }),
      ],
    });

    expect(screen.getByTestId('state-error')).toBeTruthy();
    expect(
      screen.queryByText(t('shoppingListScreen.noListsAction')),
    ).not.toBeOnTheScreen();
  });
});

// A list shown read-only would claim a refusal the server never sent.
describe('when the app cannot say what this person may do', () => {
  it('offers a retry over the lines, and another list from the switcher', async () => {
    await openListTab({ details: null, lines: [MILK] });
    expect(screen.getByTestId('state-error')).toBeTruthy();
    expect(screen.queryByLabelText('Milk')).not.toBeOnTheScreen();
    const user = userEvent.setup();

    await user.press(
      screen.getByTestId(shoppingListTestIDs.listSelectorButton),
    );
    await user.press(screen.getByText('Weekend'));

    expect(useStore.getState().selectedShoppingListId).toBe('list-2');
  });

  it('calls an unreachable server offline', async () => {
    useStore.setState({ apiReachable: false });

    await openListTab({ details: null, lines: [MILK] });

    expect(screen.getByTestId('state-offline')).toBeTruthy();
  });

  it('marks the adds as waiting on the answer, refusing none', async () => {
    await openListTab({ details: null });

    expect(shell.addMenu?.map(action => action.pending)).toEqual([
      true,
      true,
      true,
    ]);
    expect(menuEntry('search')?.disabledReason).not.toBe(
      t('shoppingListScreen.noAddPermission'),
    );
  });

  it('waits, offering no retry, while the answer is coming', async () => {
    await openListTab({ details: 'held' });

    expect(screen.queryByTestId('state-error')).not.toBeOnTheScreen();
  });
});

describe('when the lines cannot be read', () => {
  it('offers a retry rather than calling the list empty', async () => {
    await openListTab({ linesFail: true });

    expect(screen.getByTestId('state-error')).toBeTruthy();
  });
});

describe('the first-shop guide and the tips', () => {
  // Awaited outside `act`, which would hold the render that shows the step.
  it('points at the +, and from there opens the add sheet at its hint', async () => {
    tutorialSession.startGuide(GUIDE_TOURS.shop);
    const viewed = stepViewed(FIRST_SHOP_STEP.add);
    await openListTab();
    await viewed;

    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightTarget));
    await addSheetOpened();

    expect(screen.getByTestId(shoppingListTestIDs.tourSheetHint)).toBeTruthy();
  });

  /** The guide picked up at `step`, the steps before it done. */
  const guideAt = (...done: string[]) => {
    done.forEach(featureId => markFeatureHintShown(featureId, USER_ID));
    tutorialSession.startGuide(GUIDE_TOURS.shop);
  };

  it('checks off the first line from its check step', async () => {
    guideAt(FIRST_SHOP_STEP.add, FIRST_SHOP_STEP.pick);
    const tick = recordMock(UpdateShoppingListItemDocument, { held: true });
    const viewed = stepViewed(FIRST_SHOP_STEP.check);
    await openListTab({ lines: [MILK], answers: [tick] });
    await viewed;

    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightTarget));
    await log.requested(UpdateShoppingListItemDocument);

    expect(tick.fired[0]).toMatchObject({
      input: { id: 'line-1', purchaseTracking: { isPurchased: true } },
    });
  });

  it('steps aside while a sheet is open', async () => {
    guideAt(FIRST_SHOP_STEP.add, FIRST_SHOP_STEP.pick);
    const viewed = stepViewed(FIRST_SHOP_STEP.check);
    await openListTab({ lines: [MILK] });
    await viewed;

    fireEvent(
      screen.getByTestId(shoppingListTestIDs.itemRow('line-1')),
      'longPress',
    );

    expect(
      screen.queryByTestId(kitTestIDs.spotlightTarget),
    ).not.toBeOnTheScreen();
  });

  it('opens the move for the first bought line from its put-away step', async () => {
    guideAt(FIRST_SHOP_STEP.add, FIRST_SHOP_STEP.pick, FIRST_SHOP_STEP.check);
    const viewed = stepViewed(FIRST_SHOP_STEP.putAway);
    await openListTab({ lines: [BOUGHT_OATS], answers: moveSheetReads() });
    await viewed;

    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightTarget));

    await expect(moveSheetOpened()).resolves.toBeUndefined();
  });

  // Each tip is asked for, so the session's rationing of unasked ones, which
  // the sequence's own test holds, stays out of what this screen decides.
  // The tip's overlay lets gestures through, so it draws only once Jest's
  // missing layout has measured it: the step coming up is what is held here.
  it('shows the swipe tip once the list holds three lines', async () => {
    tutorialSession.startGuide('list_swipe');
    const viewed = stepViewed('shopping_list_swipe');

    await openListTab({ lines: [MILK, EGGS, BREAD] });

    await expect(viewed).resolves.toBeUndefined();
  });

  it('offers to scan the receipt once bought lines wait to go in', async () => {
    tutorialSession.startGuide('list_receipt');
    const viewed = stepViewed('list_receipt_offer');
    await openListTab({ lines: [MILK, BOUGHT_OATS] });
    await viewed;

    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightTarget));

    expect(mockNav.toReceiptScan).toHaveBeenCalledTimes(1);
  });
});

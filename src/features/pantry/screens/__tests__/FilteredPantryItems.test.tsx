'use no memo';

import React from 'react';
import type { DocumentNode } from 'graphql';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { homesData } from '#/test-utils/fixtures/homeFixtures';
import { isRecord } from '#/utils/isRecord';
import { useStore } from '#store';
import { t } from '#/i18n';
import { toDateKey, todayKey } from '#/utils/dateUtils';
import { EXPIRING_SOON_DAYS } from '#domain/expiry';
import { ErrorCode, MembershipRole } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { kitTestIDs } from '#components/testIDs';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/hooks/useAddPantryItemToShoppingList.generated';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { pantryTestIDs } from '#features/pantry/testIDs';
import {
  FilteredPantryItems,
  type FilteredPantryItemsMode,
} from '../FilteredPantryItems';

// The day stays fixed: the hook's midnight timer re-arms itself.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));
jest.mock('#hooks/navigation/useAppNavigation');
// Navigation is the boundary: with no navigator, the screen is focused while
// mounted.
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
  };
});

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

type PantryAnswer = MockDataFor<typeof GetPantryDocument>;
type Row = NonNullable<
  NonNullable<
    NonNullable<NonNullable<PantryAnswer['pantry']>['itemsConnection']>['edges']
  >[number]['node']
>;

const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

/** A stocked, undated row; its catalog item's id is unlike its own. */
const row = (id: string, itemName: string, state: Row = {}): Row => ({
  __typename: 'PantryItem',
  id,
  itemId: `catalog-${id}`,
  itemName,
  quantity: 1,
  isLowStock: false,
  expiresOn: null,
  ...state,
});

const eggs = row('eggs', 'Eggs', { isLowStock: true });
const rice = row('rice', 'Rice');
const soup = row('soup', 'Soup', { expiresOn: day(0) });
const milk = row('milk', 'Milk', { expiresOn: day(1) });
const yogurt = row('yogurt', 'Yogurt', { expiresOn: day(EXPIRING_SOON_DAYS) });
const salmon = row('salmon', 'Salmon', { expiresOn: day(-6) });
const emptyJam = row('jam', 'Jam', { quantity: 0, expiresOn: day(1) });

/** What the server answers each view with; `expiringSoon` has no lower bound. */
const SERVED = {
  lowStock: [eggs],
  expiringSoon: [yogurt, salmon, emptyJam, milk, soup],
  all: [eggs, rice, soup, milk, yogurt, salmon, emptyJam],
};

const pantryPage = (rows: Row[], hasNextPage = false): PantryAnswer => ({
  pantry: {
    id: 'p1',
    itemsConnection: {
      edges: rows.map(node => ({ node })),
      pageInfo: { hasNextPage, endCursor: hasNextPage ? 'page-1' : null },
    },
  },
});

/** The server: each view's rows, one page unless a second is asked for. */
function pantryServer({
  morePages = false,
  nextPage = [rice],
}: { morePages?: boolean; nextPage?: Row[] } = {}) {
  return recordMock(GetPantryDocument, {
    dataFor: vars => {
      if (vars.itemsCursor) return pantryPage(nextPage);
      const filter = isRecord(vars.itemsFilter) ? vars.itemsFilter : {};
      const rows = filter.lowStock
        ? SERVED.lowStock
        : filter.expiringSoon
        ? SERVED.expiringSoon
        : SERVED.all;
      return pantryPage(rows, morePages);
    },
  });
}

/**
 * A list of the home, where the user holds `role`. Both list reads select the
 * home's membership, so both state it, as the server would.
 */
const homeList = (
  id: string,
  name: string,
  role: MembershipRole,
): NonNullable<
  MockDataFor<typeof GetShoppingListDetailsDocument>['shoppingList']
> => ({
  __typename: 'ShoppingList',
  id,
  name,
  homeId: 'h1',
  home: {
    __typename: 'Home',
    id: 'h1',
    myMembership: { __typename: 'Membership', id: 'm-h1', role },
  },
  ownerships: [],
});

const addLands = () =>
  recordMock(AddItemToShoppingListFromFilteredPantryDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [{ index: 0, success: true, failure: null }],
      },
    },
  });

let log = operationLog();

/** Waits for the operation's nth answer, then lets what it started render. */
const answered = (document: DocumentNode, nth = 1) =>
  act(async () => {
    await log.answered(document, nth);
  });

interface Render {
  mode?: FilteredPantryItemsMode;
  /** The user's role in the home the chosen list belongs to. */
  role?: MembershipRole;
  /** Answers that take precedence over the ones every visit gets. */
  answers?: ReturnType<typeof recordMock>[];
  pantry?: ReturnType<typeof recordMock>;
}

/** The screen as the pantry opens it, over homes the app has already read. */
function renderScreen({
  mode,
  role = MembershipRole.Member,
  answers = [],
  pantry = pantryServer(),
}: Render = {}) {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetHomesDocument,
    data: homesData([{ id: 'h1', pantries: [{ id: 'p1' }] }]),
  });
  renderWithApollo(
    <FilteredPantryItems route={{ params: mode ? { mode } : undefined }} />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        pantry.mock,
        recordMock(GetShoppingListDetailsDocument, {
          data: { shoppingList: homeList('list-1', 'Groceries', role) },
        }).mock,
        recordMock(GetShoppingListsLiteDocument, {
          data: {
            shoppingLists: {
              edges: [
                { node: homeList('list-1', 'Groceries', role) },
                { node: homeList('list-2', 'Weekend', role) },
              ],
            },
          },
        }).mock,
        addLands().mock,
      ],
    },
  );
}

/** The screen once its view has been read. */
async function openScreen(options: Render = {}) {
  renderScreen(options);
  await answered(GetPantryDocument);
}

const names = () =>
  screen
    .getAllByText(/^(Eggs|Rice|Soup|Milk|Yogurt|Salmon|Jam)$/)
    .map(node => node.props.children);

const addLabel = () => t('labels.addToShoppingList');
const headerCart = () => screen.getByTestId(pantryTestIDs.addAllLowStockButton);
/** The carts on the rows, not the header's. */
const rowCarts = () =>
  screen
    .queryAllByLabelText(addLabel())
    .filter(cart => cart.props.testID !== pantryTestIDs.addAllLowStockButton);

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'member@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    selectedHomeId: 'h1',
    selectedPantryId: 'p1',
    isHomeSelectionReady: true,
    selectedShoppingListId: 'list-1',
    isOnline: true,
    apiReachable: true,
  });
});

describe('which rows each view lists', () => {
  it('opens on low stock when no view is named', async () => {
    await openScreen();

    expect(screen.getByText(t('filteredPantry.lowStockTitle'))).toBeTruthy();
  });

  // What the badge counts, not the `lowStockAlert` notification opt-in.
  it('asks the server for low stock as the badge counts it', async () => {
    const pantry = pantryServer();
    await openScreen({ mode: 'lowStock', pantry });

    expect(pantry.fired).toContainEqual(
      expect.objectContaining({ itemsFilter: { lowStock: true } }),
    );
    expect(names()).toEqual(['Eggs']);
  });

  it('lists the stocked rows due within the window, from the superset the server sends', async () => {
    const pantry = pantryServer();
    await openScreen({ mode: 'expiring', pantry });

    expect(pantry.fired).toContainEqual(
      expect.objectContaining({
        itemsFilter: { expiringSoon: true, today: todayKey() },
      }),
    );
    expect(names().sort()).toEqual(['Milk', 'Soup', 'Yogurt']);
  });

  it('lists what expires soonest first', async () => {
    await openScreen({ mode: 'expiring' });

    expect(names()).toEqual(['Soup', 'Milk', 'Yogurt']);
  });

  it('lists as expired only what is past its date', async () => {
    await openScreen({ mode: 'expired' });

    expect(names()).toEqual(['Salmon']);
  });

  it('pages through the whole view online', async () => {
    const pantry = pantryServer({ morePages: true, nextPage: [milk] });
    renderScreen({ mode: 'expiring', pantry });
    await answered(GetPantryDocument, 2);

    expect(pantry.fired).toContainEqual(
      expect.objectContaining({ itemsCursor: 'page-1' }),
    );
  });

  it('says all is stocked when the server finds nothing low', async () => {
    await openScreen({
      mode: 'lowStock',
      pantry: recordMock(GetPantryDocument, { data: pantryPage([]) }),
    });

    expect(screen.getByText(t('filteredPantry.lowStockEmpty'))).toBeTruthy();
  });

  it('shows the row skeleton while the view is read', () => {
    renderScreen({
      pantry: recordMock(GetPantryDocument, {
        data: pantryPage([eggs]),
        held: true,
      }),
    });

    expect(screen.getByTestId(pantryTestIDs.loading)).toBeTruthy();
  });

  // "All items are above minimum stock levels" is good news the app has no
  // evidence for when the read failed.
  it('offers a retry, not good news, when the read fails', async () => {
    await openScreen({
      pantry: recordMock(GetPantryDocument, { error: new Error('500') }),
    });

    expect(screen.getByTestId(kitTestIDs.stateError)).toBeTruthy();
    expect(screen.queryByText(t('filteredPantry.lowStockEmpty'))).toBeNull();
  });

  describe('offline', () => {
    beforeEach(() => useStore.setState({ apiReachable: false }));

    it('narrows the rows the pantry holds, asking for no view', async () => {
      const pantry = pantryServer();
      await openScreen({ mode: 'lowStock', pantry });

      expect(pantry.fired.every(vars => vars.itemsFilter == null)).toBe(true);
      expect(names()).toEqual(['Eggs']);
    });

    it('says there may be more, and pages no further', async () => {
      const pantry = pantryServer({ morePages: true });
      await openScreen({ mode: 'lowStock', pantry });

      expect(screen.getByTestId(pantryTestIDs.filteredPartial)).toBeTruthy();
      expect(pantry.fired).not.toContainEqual(
        expect.objectContaining({ itemsCursor: 'page-1' }),
      );
    });

    it('claims nothing about stock when no held row matches and there may be more', async () => {
      await openScreen({
        mode: 'lowStock',
        pantry: recordMock(GetPantryDocument, {
          data: pantryPage([rice], true),
        }),
      });

      expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
      expect(screen.queryByText(t('filteredPantry.lowStockEmpty'))).toBeNull();
    });
  });
});

describe('a row', () => {
  it('opens its detail', async () => {
    await openScreen();

    fireEvent.press(screen.getByText('Eggs'));

    expect(mockNav.toPantryItemDetail).toHaveBeenCalledWith({
      itemId: 'eggs',
    });
  });
});

describe('the cart', () => {
  it.each<FilteredPantryItemsMode>(['lowStock', 'expiring', 'expired'])(
    'is offered on every row in %s',
    async mode => {
      await openScreen({ mode });

      expect(rowCarts()).toHaveLength(names().length);
      expect(headerCart()).toBeTruthy();
    },
  );

  // `item: { itemId }` is resolved as a catalog item: the row's own id is
  // refused, for every user, every time.
  it('adds a row to the chosen list as its catalog item', async () => {
    const add = addLands();
    await openScreen({ answers: [add] });

    fireEvent.press(rowCarts()[0]!);
    await answered(AddItemToShoppingListFromFilteredPantryDocument);

    expect(add.fired).toEqual([
      {
        input: {
          shoppingListId: 'list-1',
          items: [
            expect.objectContaining({ item: { itemId: 'catalog-eggs' } }),
          ],
        },
      },
    ]);
  });

  it('asks which list to add to when none is chosen', async () => {
    useStore.setState({ selectedShoppingListId: null });
    const add = addLands();
    await openScreen({ answers: [add] });
    await answered(GetShoppingListsLiteDocument);

    fireEvent.press(rowCarts()[0]!);
    fireEvent.press(screen.getByText('Weekend'));
    await answered(AddItemToShoppingListFromFilteredPantryDocument);

    expect(add.fired).toEqual([
      {
        input: expect.objectContaining({ shoppingListId: 'list-2' }),
      },
    ]);
  });

  it('says so when the list refuses the add', async () => {
    await openScreen({
      answers: [
        recordMock(AddItemToShoppingListFromFilteredPantryDocument, {
          data: {
            addItemsToShoppingList: {
              __typename: 'ForbiddenError',
              code: ErrorCode.Forbidden,
              message: 'Not yours',
            },
          },
        }),
      ],
    });

    fireEvent.press(rowCarts()[0]!);
    await answered(AddItemToShoppingListFromFilteredPantryDocument);

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('filteredPantry.addToShoppingFailed'),
    );
  });

  it('is withheld from a guest of the chosen list', async () => {
    await openScreen({ role: MembershipRole.Guest });
    await answered(GetShoppingListDetailsDocument);
    await answered(GetShoppingListsLiteDocument);

    expect(screen.queryByLabelText(addLabel())).not.toBeOnTheScreen();
  });

  // Unknown is not a refusal: the cart is what asks which list.
  it('is offered while the list’s permission is still being read', async () => {
    const details = recordMock(GetShoppingListDetailsDocument, { held: true });
    await openScreen({ answers: [details] });

    expect(rowCarts()).toHaveLength(1);
  });

  it('adds from the header every row the view shows, and no other', async () => {
    useStore.setState({ selectedShoppingListId: null });
    const add = addLands();
    await openScreen({ mode: 'expiring', answers: [add] });
    await answered(GetShoppingListsLiteDocument);

    fireEvent.press(headerCart());
    fireEvent.press(screen.getByText('Weekend'));
    await answered(AddItemToShoppingListFromFilteredPantryDocument, 3);

    const added = add.fired.flatMap(vars =>
      isRecord(vars.input) && Array.isArray(vars.input.items)
        ? vars.input.items.map((item: unknown) =>
            isRecord(item) && isRecord(item.item) ? item.item.itemId : null,
          )
        : [],
    );
    expect(added).toEqual(['catalog-soup', 'catalog-milk', 'catalog-yogurt']);
  });

  it('names a new list after the view', async () => {
    await openScreen({ mode: 'lowStock' });

    fireEvent.press(headerCart());
    fireEvent.press(screen.getByText(t('shoppingListPicker.newList')));

    expect(
      screen.getByPlaceholderText(
        t('shoppingListPicker.newListNamePlaceholder'),
      ),
    ).toHaveDisplayValue(t('filteredPantry.lowStockTitle'));
  });
});

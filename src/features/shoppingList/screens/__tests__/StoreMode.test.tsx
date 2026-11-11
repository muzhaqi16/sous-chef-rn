import React from 'react';
import { RefreshControl } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { controlNear } from '#/test-utils/controlNear';
import {
  collaboratorsOf,
  homeShoppingList,
  listCollaborator,
  listDetailsRead,
  listLine,
  listLinesRead,
  ownShoppingList,
  type ListLine,
  type ShoppingListNode,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { kitTestIDs } from '#components/testIDs';
import { catalogTestIDs } from '#features/catalog/testIDs';
import {
  StoreDepartment,
  StoreRouteSource,
} from '#/graphql/generated/schemaTypes';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  UpdateShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ListCostToGoDocument } from '#features/shoppingList/hooks/useListCostToGo.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { AisleViewRouteDocument } from '../useAisleView.generated';
import { StoreMode } from '../StoreMode';

jest.mock('#hooks/navigation/useAppNavigation');
// Keeping the screen awake is the device's.
jest.mock('@sayem314/react-native-keep-awake', () => ({
  useKeepAwake: () => undefined,
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ID = 'sl1';
const GROCERIES = homeShoppingList(ID, 'Groceries');

const APPLES = listLine('line-1', 'Apples', {
  storeDepartment: StoreDepartment.Produce,
});
const MILK = listLine('line-2', 'Milk', {
  storeDepartment: StoreDepartment.DairyEggs,
});
const OATS = listLine('line-3', 'Oats', {
  bought: true,
  storeDepartment: StoreDepartment.BreakfastCereal,
});

/** The walk the store's route reads: produce, then dairy. */
const routeRead = () =>
  recordMock(AisleViewRouteDocument, {
    data: {
      shoppingList: {
        __typename: 'ShoppingList',
        id: ID,
        storeRoute: {
          __typename: 'StoreRoute',
          departments: [StoreDepartment.Produce, StoreDepartment.DairyEggs],
          source: StoreRouteSource.Default,
          store: null,
        },
      },
    },
  });

let log = operationLog();

interface Trip {
  list?: ShoppingListNode;
  lines?: ListLine[];
  answers?: ReturnType<typeof recordMock>[];
  /** What the device holds from an earlier trip. */
  cache?: ReturnType<typeof makeCache>;
}

/** Store mode on a list, its reads answered. */
async function openTrip({
  list = GROCERIES,
  lines = [APPLES, MILK, OATS],
  answers = [],
  cache = makeCache(),
}: Trip = {}) {
  const view = renderWithApollo(
    <StoreMode route={{ params: { listId: ID } }} />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        listDetailsRead(list).mock,
        listLinesRead(ID, lines).mock,
        routeRead().mock,
        recordMock(ListCostToGoDocument, { held: true }).mock,
      ],
    },
  );
  await log.landed(GetShoppingListDetailsDocument);
  await log.landed(GetShoppingListItemsFilteredDocument, 2);
  await log.landed(AisleViewRouteDocument);
  return view;
}

const tab = (id: string) =>
  screen.getByTestId(
    kitTestIDs.filterTab(shoppingListTestIDs.aisleTabPrefix, id),
  );
const rowOf = (lineId: string) =>
  screen.getByTestId(shoppingListTestIDs.itemRow(lineId));

/** A tick answered as the server takes it. */
const tickTaken = () =>
  recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem: {
        __typename: 'UpdateShoppingListItemPayload',
        shoppingListItem: { __typename: 'ShoppingListItem', id: 'line-1' },
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: 'u1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    budgetAndPrices: true,
    isOnline: true,
    apiReachable: true,
  });
});

describe('the trip', () => {
  it('is named after its list, every aisle open', async () => {
    await openTrip();

    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByLabelText('Apples')).toBeTruthy();
    expect(screen.getByLabelText('Milk')).toBeTruthy();
  });

  it('shows one aisle’s lines on its tab', async () => {
    await openTrip();

    fireEvent.press(tab(StoreDepartment.DairyEggs));

    expect(screen.getByLabelText('Milk')).toBeTruthy();
    expect(screen.queryByLabelText('Apples')).not.toBeOnTheScreen();
  });

  it('opens the next aisle on the walk once the open one is done', async () => {
    await openTrip({ answers: [tickTaken()] });
    fireEvent.press(tab(StoreDepartment.Produce));

    fireEvent.press(screen.getByLabelText('Apples'));
    await log.landed(UpdateShoppingListItemDocument);

    expect(screen.getByLabelText('Milk')).toBeTruthy();
  });

  it('shows the cart, and an empty one as empty', async () => {
    await openTrip();

    fireEvent.press(tab('cart'));
    expect(screen.getByText('Oats')).toBeTruthy();
    expect(screen.queryByLabelText('Apples')).not.toBeOnTheScreen();
  });

  it('says an empty cart is empty, not that the trip is done', async () => {
    await openTrip({ lines: [APPLES] });

    fireEvent.press(tab('cart'));

    expect(
      screen.getByText(t('shoppingListScreens.storeMode.cartEmpty')),
    ).toBeTruthy();
  });

  it('is done once nothing is left, and leaves on Done', async () => {
    await openTrip({ lines: [OATS] });

    expect(
      screen.getByText(t('shoppingListScreens.storeMode.allDone')),
    ).toBeTruthy();
    const [, emptyDone] = screen.getAllByText(t('labels.done'));
    if (!emptyDone) throw new Error('no Done in the empty state');
    fireEvent.press(emptyDone);

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('leaves from the header’s Done', async () => {
    await openTrip();

    fireEvent.press(screen.getByTestId(shoppingListTestIDs.storeModeDone));

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('prices what is left, as the list’s cost to go reads it', async () => {
    await openTrip({
      answers: [
        recordMock(ListCostToGoDocument, {
          data: {
            shoppingList: {
              __typename: 'ShoppingList',
              id: ID,
              costToGo: {
                __typename: 'ShoppingListCostToGo',
                amount: 12.5,
                currency: 'USD',
                pricedLines: 2,
                lines: 2,
              },
            },
          },
        }),
      ],
    });
    await log.landed(ListCostToGoDocument);

    expect(screen.getByText(/12\.50/)).toBeTruthy();
  });
});

describe('a line', () => {
  it('is ticked into the cart', async () => {
    const tick = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openTrip({ answers: [tick] });

    fireEvent.press(screen.getByLabelText('Apples'));
    await log.requested(UpdateShoppingListItemDocument);

    expect(tick.fired[0]).toMatchObject({
      input: { id: 'line-1', purchaseTracking: { isPurchased: true } },
    });
  });

  it('records what it cost from a long-press, ticking nothing first', async () => {
    const purchase = recordMock(UpdateShoppingListItemDocument, {
      held: true,
    });
    await openTrip({
      lines: [
        listLine('line-1', 'Apples', {
          quantity: 2,
          storeDepartment: StoreDepartment.Produce,
        }),
      ],
      answers: [purchase],
    });

    fireEvent(rowOf('line-1'), 'longPress');
    const quantity = screen.getByTestId(
      shoppingListTestIDs.purchaseQuantityInput,
    );
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
    await openTrip();

    fireEvent.press(rowOf('line-1'));

    expect(mockNav.toShoppingListItemDetail).toHaveBeenCalledWith({
      listId: ID,
      itemId: 'line-1',
    });
  });

  it('moves to another aisle from its swipe', async () => {
    const move = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openTrip({ answers: [move] });

    fireEvent(rowOf('line-1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'aisle' },
    });
    fireEvent.press(
      screen.getByText(
        t(`shoppingListScreens.aisles.department.${StoreDepartment.Bakery}`),
      ),
    );
    await log.requested(UpdateShoppingListItemDocument);

    expect(move.fired[0]).toMatchObject({
      input: {
        id: 'line-1',
        storePrefs: { storeDepartmentOverride: StoreDepartment.Bakery },
      },
    });
  });

  it('in the cart has no aisle to move to', async () => {
    const move = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openTrip({ answers: [move] });
    fireEvent.press(tab('cart'));

    fireEvent(rowOf('line-3'), 'accessibilityAction', {
      nativeEvent: { actionName: 'aisle' },
    });

    expect(
      screen.queryByText(
        t(`shoppingListScreens.aisles.department.${StoreDepartment.Bakery}`),
      ),
    ).not.toBeOnTheScreen();
    expect(move.fired).toEqual([]);
  });
});

describe('the scan', () => {
  it('scans into this trip', async () => {
    await openTrip();

    fireEvent.press(screen.getByTestId(shoppingListTestIDs.storeModeScan));

    expect(mockNav.toBarcode).toHaveBeenCalledWith({
      source: 'storeMode',
      shoppingListId: ID,
    });
  });

  it('is not offered to someone who cannot tick lines', async () => {
    await openTrip({
      list: {
        ...ownShoppingList(ID, 'Groceries'),
        ownerships: [],
        collaboratorsConnection: collaboratorsOf(listCollaborator('u1')),
      },
    });

    expect(
      screen.queryByTestId(shoppingListTestIDs.storeModeScan),
    ).not.toBeOnTheScreen();
  });
});

describe('the store', () => {
  const atCornerShop: ShoppingListNode = {
    ...GROCERIES,
    targetStore: { __typename: 'Store', id: 'store-1', name: 'Corner Shop' },
  };

  it('is named, and its own walk is read', async () => {
    const route = routeRead();
    await openTrip({ list: atCornerShop, answers: [route] });

    expect(
      screen.getByText(
        t('shoppingListScreens.storeMode.atStore', { store: 'Corner Shop' }),
      ),
    ).toBeTruthy();
    expect(route.fired).toContainEqual({ id: ID, storeId: 'store-1' });
  });

  it('is chosen for the list by whoever may edit it', async () => {
    const update = recordMock(UpdateShoppingListDocument, { held: true });
    await openTrip({
      answers: [
        update,
        recordMock(SearchStoresDocument, {
          data: {
            stores: {
              __typename: 'StoreConnection',
              edges: [
                {
                  __typename: 'StoreEdge',
                  node: {
                    __typename: 'Store',
                    id: 'store-2',
                    name: 'Market Hall',
                  },
                },
              ],
            },
          },
        }),
      ],
    });

    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.storeModeChooseStore),
    );
    fireEvent.changeText(
      screen.getByTestId(
        catalogTestIDs.autocompleteSearch(
          shoppingListTestIDs.storeModeStoreField,
        ),
      ),
      'Mar',
    );
    await log.landed(SearchStoresDocument);
    fireEvent.press(screen.getByText('Market Hall'));
    await log.requested(UpdateShoppingListDocument);

    expect(update.fired[0]).toMatchObject({
      input: { planning: { targetStoreId: 'store-2' } },
    });
  });

  it('is not chosen by someone who edits only its lines', async () => {
    await openTrip({
      list: {
        ...ownShoppingList(ID, 'Groceries'),
        ownerships: [],
        collaboratorsConnection: collaboratorsOf(
          listCollaborator('u1', {
            canEditItems: true,
            canMarkPurchased: true,
          }),
        ),
      },
    });

    expect(
      screen.queryByTestId(shoppingListTestIDs.storeModeChooseStore),
    ).not.toBeOnTheScreen();
  });
});

describe('when the lines cannot be read', () => {
  it('says so, and reads again on a retry', async () => {
    const linesFail = recordMock(GetShoppingListItemsFilteredDocument, {
      error: new Error('Network request failed'),
      held: true,
    });
    renderWithApollo(<StoreMode route={{ params: { listId: ID } }} />, {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        linesFail.mock,
        listDetailsRead(GROCERIES).mock,
        routeRead().mock,
        recordMock(ListCostToGoDocument, { held: true }).mock,
      ],
    });
    await log.landed(GetShoppingListDetailsDocument);
    await log.landed(AisleViewRouteDocument);
    linesFail.release();
    // To buy, then the cart: both fail.
    await log.landed(GetShoppingListItemsFilteredDocument, 2);

    fireEvent.press(screen.getByText(t('labels.tryAgain')));

    await expect(
      log.requested(GetShoppingListItemsFilteredDocument, 3),
    ).resolves.toBeUndefined();
  });

  // Held until the rest is in: a failed read holding nothing is asked again
  // whenever another read writes the list.
  it('keeps the lines it holds when the cart cannot be read', async () => {
    const cartFails = recordMock(GetShoppingListItemsFilteredDocument, {
      error: new Error('Network request failed'),
      match: variables => variables.isPurchased === true,
      held: true,
    });
    renderWithApollo(<StoreMode route={{ params: { listId: ID } }} />, {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        cartFails.mock,
        listDetailsRead(GROCERIES).mock,
        listLinesRead(ID, [APPLES]).mock,
        routeRead().mock,
        recordMock(ListCostToGoDocument, { held: true }).mock,
      ],
    });
    await log.landed(GetShoppingListDetailsDocument);
    await log.landed(GetShoppingListItemsFilteredDocument);
    await log.landed(AisleViewRouteDocument);

    cartFails.release();
    await log.landed(GetShoppingListItemsFilteredDocument, 2);

    expect(screen.getByLabelText('Apples')).toBeTruthy();
    expect(screen.queryByTestId('state-error')).not.toBeOnTheScreen();
  });

  it('opens again on the lines it holds while it reads them again', async () => {
    const cache = makeCache();
    const earlier = await openTrip({ cache });
    earlier.unmount();
    log = operationLog();

    renderWithApollo(<StoreMode route={{ params: { listId: ID } }} />, {
      cache,
      links: [log.link],
      operationMocks: [
        recordMock(GetShoppingListItemsFilteredDocument, { held: true }).mock,
        listDetailsRead(GROCERIES).mock,
        routeRead().mock,
        recordMock(ListCostToGoDocument, { held: true }).mock,
      ],
    });
    await log.requested(GetShoppingListItemsFilteredDocument);

    expect(screen.getByLabelText('Apples')).toBeTruthy();
  });

  it('keeps its lines on screen while a pull reads them again', async () => {
    await openTrip({
      answers: [
        listLinesRead(ID, [APPLES, MILK, OATS], { maxUsageCount: 2 }),
        recordMock(GetShoppingListItemsFilteredDocument, { held: true }),
      ],
    });

    act(() => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await log.requested(GetShoppingListItemsFilteredDocument, 3);

    expect(screen.getByLabelText('Apples')).toBeTruthy();
  });
});

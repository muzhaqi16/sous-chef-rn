import React from 'react';
import { gql, type InMemoryCache } from '@apollo/client';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import {
  HELD_UNITS,
  LITER,
  catalogSearches,
} from '#/test-utils/fixtures/catalogSearches';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';
import { ErrorCode, UnitSystem } from '#/graphql/generated/schemaTypes';
import { catalogTestIDs } from '#features/catalog/testIDs';
import {
  AddItemToShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ShoppingListItemForEditDocument } from '#features/shoppingList/hooks/useShoppingListItemWrites.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import {
  AutocompleteItemsDocument,
  SearchBrandsDocument,
} from '#operations/item/item.generated';
import { SearchUnitsDocument } from '#operations/item/unit.generated';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { AddEditItem } from '../AddEditItem';

jest.mock('#hooks/navigation/useAppNavigation');
// The keypad's decimal separator is the device's.
jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ADD = shoppingListTestIDs.addItemForm;
const EDIT = shoppingListTestIDs.editItemForm;

type Line = NonNullable<
  MockDataFor<typeof ShoppingListItemForEditDocument>['shoppingListItem']
>;

/** One litre of milk, as the edit form reads it. */
const MILK: Line = {
  __typename: 'ShoppingListItem',
  id: 'item1',
  itemName: 'Milk',
  quantity: 1,
  quantityInput: '1',
  unitName: 'L',
  notes: null,
  category: null,
  priority: 0,
  version: 4,
  unit: { __typename: 'Unit', id: 'unit-l' },
  priceEstimate: { __typename: 'PriceEstimate', estimated: null },
  storeInfo: { __typename: 'ShoppingListItemStoreInfo', preferredStore: null },
  brand: null,
  netWeight: null,
  netWeightUnit: null,
};

type Suggestion = NonNullable<
  MockDataFor<typeof AutocompleteItemsDocument>['autocompleteItems']
>['suggestions'];

/** What the catalog finds for any search. */
const catalogRead = (suggestions: Suggestion = []) =>
  recordMock(AutocompleteItemsDocument, {
    data: {
      autocompleteItems: { __typename: 'AutocompleteResult', suggestions },
    },
  });

let log = operationLog();

interface Open {
  /** The line an edit opens; none opens the add form. */
  line?: Line;
  answers?: ReturnType<typeof recordMock>[];
  initialItemName?: string;
}

/** The form as the list opens it, its user's settings held. */
function renderForm({ line, answers = [], initialItemName }: Open = {}) {
  const cache = makeCache();
  writeUnitSystemSettings(cache, UnitSystem.Metric, UnitSystem.Metric);
  renderWithApollo(
    <AddEditItem
      route={{
        params: line
          ? { listId: 'sl1', itemId: line.id ?? '' }
          : { listId: 'sl1', initialItemName },
      }}
    />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        ...(line
          ? [
              recordMock(ShoppingListItemForEditDocument, {
                data: { shoppingListItem: line },
              }).mock,
            ]
          : []),
        catalogRead().mock,
        ...catalogSearches().map(answer => answer.mock),
      ],
    },
  );
  return cache;
}

async function openEdit(line: Line = MILK, answers: Open['answers'] = []) {
  const cache = renderForm({ line, answers });
  await log.landed(ShoppingListItemForEditDocument);
  return cache;
}

/** Types into a picker's search and presses its first row. */
async function pick(
  fieldTestID: string,
  search: string,
  document: Parameters<typeof log.landed>[0],
  nth = 1,
) {
  fireEvent.changeText(screen.getByTestId(fieldTestID), search);
  await log.requested(document, nth);
  await log.landed(document, nth);
  fireEvent.press(
    screen.getByTestId(catalogTestIDs.suggestion(fieldTestID, 0)),
  );
}

/** Save, settled as a press settles: the form validates before it submits. */
const save = (ids: typeof ADD) =>
  userEvent.setup().press(screen.getByTestId(ids.submitButton));

/** An add the server took, as the queue reports one it holds. */
const addTaken = () =>
  recordMock(AddItemToShoppingListDocument, {
    data: { addItemsToShoppingList: null },
  });

/** The line an add sent. */
function sentLine(add: ReturnType<typeof recordMock>) {
  const [variables] = add.fired;
  if (!variables) throw new Error('nothing was added');
  const [line] = (inputOf(variables).items as Record<string, unknown>[]) ?? [];
  if (!line) throw new Error('the add held no line');
  return line;
}

const ROW = gql`
  fragment AddEditItemTestRow on ShoppingListItem {
    itemName
    unit {
      id
    }
  }
`;

/** The row an add put in the cache, under the id it sent. */
function addedRow(cache: InMemoryCache, add: ReturnType<typeof recordMock>) {
  const line = sentLine(add);
  const id = String(line.id);
  return cache.readFragment<{ itemName: string; unit: { id: string } | null }>({
    id: cache.identify({ __typename: 'ShoppingListItem', id }),
    fragment: ROW,
    optimistic: true,
  });
}

/** Presses `label` on the last alert raised, as the person answers it. */
function answerAlert(label: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls.at(-1) ?? [];
  const button = buttons?.find(candidate => candidate.text === label);
  if (!button?.onPress) throw new Error(`no ${label} on the last alert`);
  button.onPress();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.');
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
    cachedUnits: HELD_UNITS,
    lastUnitsFetchedAt: Date.now(),
  });
});

describe('an edit', () => {
  it('opens on the line, and saves only what changed, at its version', async () => {
    const update = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openEdit(MILK, [update]);

    expect(screen.getByTestId(EDIT.nameInput)).toHaveDisplayValue('Milk');
    // A line's name is renamed, not looked up in the catalog.
    expect(
      screen.queryByTestId(catalogTestIDs.autocompleteSearch(EDIT.nameInput)),
    ).not.toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId(EDIT.nameInput), 'Oat milk');
    await save(EDIT);
    await log.requested(UpdateShoppingListItemDocument);

    expect(update.fired[0]).toEqual({
      input: {
        id: 'item1',
        version: 4,
        itemName: 'Oat milk',
        idempotencyKey: expect.any(String),
      },
    });
  });

  it('leaves an unchanged line without writing it', async () => {
    const update = recordMock(UpdateShoppingListItemDocument, { held: true });
    await openEdit(MILK, [update]);

    await save(EDIT);

    expect(mockNav.goBack).toHaveBeenCalled();
    expect(update.fired).toEqual([]);
  });

  it('leaves once the edit is applied', async () => {
    await openEdit(MILK, [
      recordMock(UpdateShoppingListItemDocument, {
        data: {
          updateShoppingListItem: {
            __typename: 'UpdateShoppingListItemPayload',
            shoppingListItem: { __typename: 'ShoppingListItem', id: 'item1' },
          },
        },
      }),
    ]);

    fireEvent.changeText(screen.getByTestId(EDIT.nameInput), 'Oat milk');
    await save(EDIT);
    await log.landed(UpdateShoppingListItemDocument);

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  // The refusal re-reads the line: what was typed must survive it.
  it('stays on a refusal, keeping what was typed', async () => {
    await openEdit(MILK, [
      recordMock(UpdateShoppingListItemDocument, {
        data: {
          updateShoppingListItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'No item',
          },
        },
      }),
    ]);

    fireEvent.changeText(screen.getByTestId(EDIT.nameInput), 'Oat milk');
    await save(EDIT);
    await log.landed(UpdateShoppingListItemDocument);

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(screen.getByTestId(EDIT.nameInput)).toHaveDisplayValue('Oat milk');
  });

  it('offers Refresh on a version conflict, which leaves the form', async () => {
    await openEdit(MILK, [
      recordMock(UpdateShoppingListItemDocument, {
        data: {
          updateShoppingListItem: {
            __typename: 'ConflictError',
            code: ErrorCode.VersionConflict,
            message: 'Stale version',
          },
        },
      }),
    ]);

    fireEvent.changeText(screen.getByTestId(EDIT.nameInput), 'Oat milk');
    await save(EDIT);
    await log.landed(UpdateShoppingListItemDocument);
    answerAlert(t('labels.refresh'));

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('offers no Save for a line it cannot read, and reads it again on a retry', async () => {
    renderForm({
      line: MILK,
      answers: [
        recordMock(ShoppingListItemForEditDocument, {
          error: new Error('Network request failed'),
        }),
      ],
    });
    await log.landed(ShoppingListItemForEditDocument);

    expect(screen.queryByTestId(EDIT.submitButton)).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText(t('labels.tryAgain')));

    await expect(
      log.requested(ShoppingListItemForEditDocument, 2),
    ).resolves.toBeUndefined();
  });

  // Held from the list, the line seeds the form before the handed name could.
  it('never takes a name handed to an add', async () => {
    const cache = makeCache();
    seedQuery(cache, {
      query: ShoppingListItemForEditDocument,
      variables: { id: 'item1' },
      data: { __typename: 'Query', shoppingListItem: MILK },
    });
    renderWithApollo(
      <AddEditItem
        route={{
          params: { listId: 'sl1', itemId: 'item1', initialItemName: 'Eggs' },
        }}
      />,
      {
        cache,
        links: [log.link],
        operationMocks: [
          recordMock(ShoppingListItemForEditDocument, {
            data: { shoppingListItem: MILK },
          }).mock,
          ...catalogSearches().map(answer => answer.mock),
        ],
      },
    );
    await log.landed(ShoppingListItemForEditDocument);

    expect(screen.getByTestId(EDIT.nameInput)).toHaveDisplayValue('Milk');
  });
});

describe('an add', () => {
  it('opens on the name it was handed', () => {
    renderForm({ initialItemName: 'Eggs' });

    expect(screen.getByTestId(ADD.nameInput)).toHaveDisplayValue('Eggs');
  });

  it('sends a typed line with all it was given, puts it in the list, and leaves', async () => {
    const add = addTaken();
    const cache = renderForm({ answers: [add] });

    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Oat milk');
    fireEvent.changeText(screen.getByTestId(ADD.quantityInput), '2');
    await pick(ADD.unitPicker, 'li', SearchUnitsDocument);
    await pick(ADD.brandInput, 'Hor', SearchBrandsDocument);
    fireEvent.changeText(screen.getByTestId(ADD.netWeightInput), '500');
    await pick(ADD.netWeightUnitPicker, 'gr', SearchUnitsDocument, 2);
    fireEvent.changeText(screen.getByTestId(ADD.priceInput), '3.50');
    fireEvent.press(screen.getByText(t('shoppingListScreens.priorityHigh')));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('shoppingListScreens.storePlaceholder')),
      'Cor',
    );
    await log.landed(SearchStoresDocument);
    fireEvent.press(screen.getByText('Corner Shop'));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('shoppingListScreens.notesPlaceholder')),
      'the big one',
    );
    await save(ADD);
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(add)).toMatchObject({
      item: { inline: { name: 'Oat milk' } },
      quantity: '2',
      unit: { id: 'unit-l' },
      brand: { id: 'brand-horizon' },
      netWeight: { netWeight: 500, netWeightUnitId: 'unit-g' },
      pricing: { estimatedPrice: 3.5 },
      priority: 2,
      storePrefs: { preferredStoreId: 'store-tj' },
      notes: 'the big one',
    });
    expect(addedRow(cache, add)).toMatchObject({
      itemName: 'Oat milk',
      unit: { id: 'unit-l' },
    });
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('takes a catalog item’s name, unit and category', async () => {
    const add = addTaken();
    renderForm({
      answers: [
        add,
        catalogRead([
          {
            __typename: 'ItemSuggestion',
            id: 'item-milk',
            name: 'Whole milk',
            defaultUnit: { ...LITER, __typename: 'ItemUnitSuggestion' },
            category: {
              __typename: 'ItemCategorySuggestion',
              id: 'cat-dairy',
              name: 'Dairy',
            },
          },
        ]),
      ],
    });

    await pick(ADD.nameInput, 'Whole', AutocompleteItemsDocument);
    expect(screen.getByTestId(ADD.nameInput)).toHaveDisplayValue('Whole milk');
    expect(screen.getByTestId(ADD.unitPicker)).toHaveDisplayValue('L');
    expect(
      screen.getByPlaceholderText(t('labels.eGDairyProduce')),
    ).toHaveDisplayValue('Dairy');
    await save(ADD);
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(add)).toMatchObject({
      unit: { id: 'unit-l' },
      category: 'Dairy',
    });
  });

  it('sends a comma device’s quantity as the API reads it', async () => {
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
    const add = addTaken();
    renderForm({ answers: [add] });

    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Flour');
    fireEvent.changeText(screen.getByTestId(ADD.quantityInput), '2,5');
    await save(ADD);
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(add)).toMatchObject({ quantity: '2.5' });
  });

  it('asks for no price, and sends none, with prices turned off', async () => {
    useStore.setState({ budgetAndPrices: false });
    const add = addTaken();
    renderForm({ answers: [add] });

    expect(screen.queryByTestId(ADD.priceInput)).not.toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Flour');
    await save(ADD);
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(add)).not.toHaveProperty('pricing');
  });

  it('reports a missing name and quantity on their fields', async () => {
    const add = addTaken();
    renderForm({ answers: [add] });

    fireEvent.changeText(screen.getByTestId(ADD.quantityInput), '');
    await save(ADD);

    expect(screen.getByText(t('errors.itemNameRequired'))).toBeTruthy();
    expect(
      screen.getByText(t('shoppingListScreens.pleaseEnterQuantity')),
    ).toBeTruthy();
    expect(add.fired).toEqual([]);
  });

  it('reports a weight with no unit on the unit', async () => {
    renderForm();

    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Flour');
    fireEvent.changeText(screen.getByTestId(ADD.netWeightInput), '500');
    await save(ADD);

    expect(
      screen.getByText(t('labels.pleaseSelectAUnitForTheNetWeight')),
    ).toBeTruthy();
  });

  it('reports a weight unit with no weight on the weight', async () => {
    renderForm();

    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Flour');
    await pick(ADD.netWeightUnitPicker, 'gr', SearchUnitsDocument);
    await save(ADD);

    expect(screen.getByText(t('errors.field.netWeight'))).toBeTruthy();
  });

  it('stays on a refusal, saying so once', async () => {
    renderForm({
      answers: [
        recordMock(AddItemToShoppingListDocument, {
          data: {
            addItemsToShoppingList: {
              __typename: 'ForbiddenError',
              code: ErrorCode.Forbidden,
              message: 'No item',
            },
          },
        }),
      ],
    });

    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Flour');
    await save(ADD);
    await log.landed(AddItemToShoppingListDocument);

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it('cannot be saved again while it is saving', async () => {
    renderForm({
      answers: [recordMock(AddItemToShoppingListDocument, { held: true })],
    });

    fireEvent.changeText(screen.getByTestId(ADD.nameInput), 'Flour');
    await save(ADD);
    await log.requested(AddItemToShoppingListDocument);

    expect(screen.getByTestId(ADD.submitButton)).toBeDisabled();
  });

  it('closes without adding', () => {
    renderForm();

    const [close] = screen.getAllByLabelText(t('labels.close'));
    if (!close) throw new Error('no Close');
    fireEvent.press(close);

    expect(mockNav.goBack).toHaveBeenCalled();
  });
});

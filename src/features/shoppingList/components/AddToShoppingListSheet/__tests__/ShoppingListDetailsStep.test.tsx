import React from 'react';
import { BackHandler, TextInput } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { withDeadline } from '#/test-utils/cacheWaits';
import {
  HELD_UNITS,
  catalogSearches,
} from '#/test-utils/fixtures/catalogSearches';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { ErrorCode, UnitSystem } from '#/graphql/generated/schemaTypes';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { SearchBrandsDocument } from '#operations/item/item.generated';
import { SearchUnitsDocument } from '#operations/item/unit.generated';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { ShoppingListDetailsStep } from '../ShoppingListDetailsStep';

let log = operationLog();

const NAME = shoppingListTestIDs.addSheetNameInput;
const QUANTITY = shoppingListTestIDs.addSheetQuantityInput;
const UNIT = shoppingListTestIDs.addSheetUnitPicker;

/** An add the queue holds, as it reports one it took. */
const addTaken = () =>
  recordMock(AddItemToShoppingListDocument, {
    data: { addItemsToShoppingList: null },
  });

interface Step {
  answers?: ReturnType<typeof recordMock>[];
  prefilledItemName?: string;
  onClose?: () => void;
  onSuccess?: () => void;
  onHoldOpen?: (held: boolean) => void;
}

/** The step as the add sheet opens it, on list-1. */
function renderStep({
  answers = [],
  prefilledItemName,
  onClose = jest.fn(),
  onSuccess = jest.fn(),
  onHoldOpen,
}: Step = {}) {
  const cache = makeCache();
  writeUnitSystemSettings(cache, UnitSystem.Metric, UnitSystem.Metric);
  renderWithApollo(
    <ShoppingListDetailsStep
      shoppingListId="list-1"
      prefilledItemName={prefilledItemName}
      onClose={onClose}
      onSuccess={onSuccess}
      onHoldOpen={onHoldOpen}
    />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        ...catalogSearches().map(answer => answer.mock),
      ],
    },
  );
}

/** The line an add sent. */
function sentLine(add: ReturnType<typeof recordMock>) {
  const [variables] = add.fired;
  if (!variables) throw new Error('nothing was added');
  const [line] = (inputOf(variables).items as Record<string, unknown>[]) ?? [];
  if (!line) throw new Error('the add held no line');
  return line;
}

/** Add, settled as a press settles: the form validates before it submits. */
const add = () =>
  userEvent
    .setup()
    .press(screen.getByTestId(shoppingListTestIDs.addSheetSubmitButton));

/** Types into a picker's search, waits for its answer, and picks `row`. */
async function pick(
  search: ReturnType<typeof screen.getByTestId>,
  text: string,
  document: Parameters<typeof log.landed>[0],
  row: string,
  nth = 1,
) {
  fireEvent.changeText(search, text);
  await log.requested(document, nth);
  await log.landed(document, nth);
  fireEvent.press(screen.getAllByText(row).at(-1) ?? screen.getByText(row));
}

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
    cachedUnits: HELD_UNITS,
    lastUnitsFetchedAt: Date.now(),
  });
});

describe('the details step', () => {
  it('opens on the name searched for, as a plain field', () => {
    renderStep({ prefilledItemName: 'Vanilla ice cream' });

    fireEvent.changeText(screen.getByTestId(NAME), 'Vanilla ice cream bar');

    expect(screen.getByTestId(NAME).props.value).toBe('Vanilla ice cream bar');
    expect(
      screen.queryByTestId(catalogTestIDs.autocompleteSearch(NAME)),
    ).toBeNull();
  });

  it('adds a line with all it was given, and closes', async () => {
    const onSuccess = jest.fn();
    const added = addTaken();
    renderStep({ answers: [added], onSuccess });

    fireEvent.changeText(screen.getByTestId(NAME), 'Oat milk');
    fireEvent.changeText(screen.getByTestId(QUANTITY), '2');
    fireEvent.changeText(
      screen.getByTestId(catalogTestIDs.autocompleteSearch(UNIT)),
      'li',
    );
    await log.requested(SearchUnitsDocument);
    await log.landed(SearchUnitsDocument);
    // The weight unit's picker lists the same search: the unit's own first row.
    fireEvent.press(screen.getByTestId(catalogTestIDs.suggestion(UNIT, 0)));
    await pick(
      screen.getByPlaceholderText(t('autocomplete.brandSearch')),
      'Hor',
      SearchBrandsDocument,
      'Horizon',
    );
    fireEvent.changeText(screen.getByPlaceholderText('e.g., 500'), '500');
    const [, weightUnitSearch] = screen.getAllByPlaceholderText(
      t('labels.typeToSearchUnits'),
    );
    if (!weightUnitSearch) throw new Error('no weight unit search');
    await pick(weightUnitSearch, 'gr', SearchUnitsDocument, 'gram', 2);
    fireEvent.changeText(screen.getByPlaceholderText('e.g., 4.99'), '3.50');
    fireEvent.press(screen.getByText(t('shoppingListScreens.priorityHigh')));
    await pick(
      screen.getByPlaceholderText(t('autocomplete.storeSearch')),
      'Cor',
      SearchStoresDocument,
      'Corner Shop',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Any special notes...'),
      'the big one',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText(t('labels.eGDairyProduce')),
      'Dairy',
    );
    await add();
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(added)).toMatchObject({
      item: { inline: { name: 'Oat milk' } },
      quantity: '2',
      unit: { id: 'unit-l' },
      brand: { id: 'brand-horizon' },
      netWeight: { netWeight: 500, netWeightUnitId: 'unit-g' },
      pricing: { estimatedPrice: 3.5 },
      priority: 2,
      storePrefs: { preferredStoreId: 'store-tj' },
      notes: 'the big one',
      category: 'Dairy',
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('sends a brand typed rather than picked by its name', async () => {
    const added = addTaken();
    renderStep({ answers: [added], prefilledItemName: 'Oats' });

    fireEvent.changeText(
      screen.getByPlaceholderText(t('shoppingListScreens.brandPlaceholder')),
      ' Quaker ',
    );
    await add();
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(added)).toMatchObject({ brand: { name: 'Quaker' } });
  });

  // The switch is the account's, so another device can turn it off mid-form.
  it('asks for no price, and sends none typed, once prices are off', async () => {
    const added = addTaken();
    renderStep({ answers: [added], prefilledItemName: 'Bananas' });
    fireEvent.changeText(screen.getByPlaceholderText('e.g., 4.99'), '3.50');

    await act(async () => {
      useStore.setState({ budgetAndPrices: false });
    });

    expect(
      screen.queryByText(t('shoppingListScreens.estimatedPrice')),
    ).not.toBeOnTheScreen();
    await add();
    await log.landed(AddItemToShoppingListDocument);

    expect(sentLine(added)).not.toHaveProperty('pricing');
  });

  it('stays open with what was typed when the add is refused', async () => {
    const onSuccess = jest.fn();
    renderStep({
      answers: [
        recordMock(AddItemToShoppingListDocument, {
          data: {
            addItemsToShoppingList: {
              __typename: 'ForbiddenError',
              code: ErrorCode.Forbidden,
              message: 'No',
            },
          },
        }),
      ],
      onSuccess,
      prefilledItemName: 'Bananas',
    });

    await add();
    await log.landed(AddItemToShoppingListDocument);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId(NAME).props.value).toBe('Bananas');
  });
});

describe('the return key', () => {
  // The spy's `this` says which input took focus.
  const input = (props: Record<string, string>) =>
    expect.objectContaining({ props: expect.objectContaining(props) });

  /** Presses return on `field`, resolved once another input takes focus. */
  const pressReturn = (field: ReturnType<typeof screen.getByTestId>) => {
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    const focused = withDeadline(
      done => {
        focus.mockImplementation(() => done());
        return () => undefined;
      },
      () => 'nothing took focus',
    );
    fireEvent(field, 'submitEditing');
    return focused.then(() => focus.mock.contexts.at(-1));
  };

  it('moves through the typed fields in order', async () => {
    renderStep();

    await expect(pressReturn(screen.getByTestId(NAME))).resolves.toEqual(
      input({ testID: QUANTITY }),
    );
    await expect(pressReturn(screen.getByTestId(QUANTITY))).resolves.toEqual(
      input({ placeholder: 'e.g., 500' }),
    );
    await expect(
      pressReturn(screen.getByPlaceholderText('e.g., 500')),
    ).resolves.toEqual(input({ placeholder: 'e.g., 4.99' }));
    await expect(
      pressReturn(screen.getByPlaceholderText('e.g., 4.99')),
    ).resolves.toEqual(input({ placeholder: 'Any special notes...' }));
  });

  it('skips the price on the way to Notes with prices turned off', async () => {
    useStore.setState({ budgetAndPrices: false });
    renderStep();

    await expect(
      pressReturn(screen.getByPlaceholderText('e.g., 500')),
    ).resolves.toEqual(input({ placeholder: 'Any special notes...' }));
  });

  it('focuses the name when an add fails on it', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    const added = addTaken();
    renderStep({ answers: [added] });

    await add();

    expect(added.fired).toEqual([]);
    expect(focus.mock.contexts).toContainEqual(input({ testID: NAME }));
  });
});

describe('Cancel', () => {
  /** Resolves once typed input holds the sheet open, the form marked dirty. */
  const heldOpen = (onHoldOpen: jest.Mock) =>
    withDeadline(
      done => {
        onHoldOpen.mockImplementation((held: boolean) => {
          if (held) done();
        });
        return () => undefined;
      },
      () => 'the sheet was never held open',
    );

  it('closes an untouched form at once', () => {
    const onClose = jest.fn();
    renderStep({ onClose, prefilledItemName: 'Bananas' });

    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.addSheetCancelButton),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('asks before dropping what was typed, holding the sheet open', async () => {
    const onClose = jest.fn();
    const onHoldOpen = jest.fn();
    renderStep({ onClose, onHoldOpen });
    const dirty = heldOpen(onHoldOpen);

    fireEvent.changeText(screen.getByTestId(NAME), 'Bananas');
    await dirty;
    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.addSheetCancelButton),
    );

    expect(onClose).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalledWith(
      t('confirmations.discardChangesTitle'),
      t('confirmations.discardChanges'),
      expect.any(Array),
    );
  });

  it("asks on Android's Back too while input would be lost", async () => {
    const added = jest.spyOn(BackHandler, 'addEventListener');
    const onHoldOpen = jest.fn();
    renderStep({ onHoldOpen });
    const dirty = heldOpen(onHoldOpen);

    fireEvent.changeText(screen.getByTestId(NAME), 'Bananas');
    await dirty;
    const [, onBack] = added.mock.calls.at(-1) ?? [];

    expect(onBack?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('confirmations.discardChangesTitle'),
      t('confirmations.discardChanges'),
      expect.any(Array),
    );
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

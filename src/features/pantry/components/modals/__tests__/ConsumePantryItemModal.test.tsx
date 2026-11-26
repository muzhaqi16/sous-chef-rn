import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { ConsumePantryItemModal } from '../ConsumePantryItemModal';
import { renderWithApollo, recordMock } from '#/test-utils/apolloMockProvider';
import { alertService } from '#services/alertService';
import { pantryTestIDs } from '#features/pantry/testIDs';
import {
  ACTION_ITEM_ID,
  actionItemCache,
  rankedUnit,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UnitType, UsagePurpose } from '#graphql/generated/schemaTypes';
import { operationLog } from '#/test-utils/operationLog';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { t } from '#i18n';

type Props = React.ComponentProps<typeof ConsumePantryItemModal>;

it('waits for settlement and retains entered quantity after a refusal', async () => {
  let settle!: (outcome: string) => void;
  const pending = new Promise<string>(resolve => {
    settle = resolve;
  });
  const onConfirm = jest.fn(() => pending);
  const onClose = jest.fn();
  const units = recordMock(ConsumptionUnitsForPantryItemDocument, {
    data: {
      consumptionUnitsForPantryItem: [
        rankedUnit(
          { id: 'u1', name: 'Pounds', symbol: 'lbs', type: UnitType.Weight },
          0,
        ),
      ],
    },
  });
  renderWithApollo(
    <ConsumePantryItemModal
      visible
      pantryItemId={ACTION_ITEM_ID}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
    {
      cache: actionItemCache(),
      operationMocks: [units.mock],
    },
  );
  const quantity = screen.getByDisplayValue('1');
  fireEvent.changeText(quantity, '2');
  // The form checks the amount before it confirms, asynchronously.
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: t('labels.confirm') }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: t('labels.confirm') }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: t('labels.confirm') }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => {
    settle('failed');
    await pending;
  });
  expect(screen.getByDisplayValue('2')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: t('labels.confirm') }),
  ).toBeEnabled();
  expect(onClose).not.toHaveBeenCalled();
});

it('offers use-all with optional details in the compact presentation', async () => {
  // Resolved when the modal confirms, so the test awaits the call itself.
  let confirmed!: () => void;
  const called = new Promise<void>(resolve => {
    confirmed = resolve;
  });
  const onConfirm = jest.fn(() => {
    confirmed();
    return Promise.resolve('applied');
  });
  const units = recordMock(ConsumptionUnitsForPantryItemDocument, {
    data: {
      consumptionUnitsForPantryItem: [
        rankedUnit(
          { id: 'u1', name: 'Pounds', symbol: 'lbs', type: UnitType.Weight },
          0,
        ),
      ],
    },
  });
  renderWithApollo(
    <ConsumePantryItemModal
      compact
      visible
      pantryItemId={ACTION_ITEM_ID}
      onClose={jest.fn()}
      onConfirm={onConfirm}
    />,
    {
      cache: actionItemCache(),
      operationMocks: [units.mock],
    },
  );
  expect(screen.queryByText(t('labels.notes'))).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: t('consumeItem.useAll') }),
  );
  expect(screen.getByDisplayValue('5')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: t('labels.confirm') }));
  await act(async () => {
    await called;
  });
  expect(onConfirm).toHaveBeenCalledWith({
    quantity: 5,
    all: false,
    purpose: expect.any(String),
    notes: '',
    usageUnitId: 'u1',
  });
  fireEvent.press(
    screen.getByRole('button', { name: t('consumeItem.optionalDetails') }),
  );
  expect(screen.getByText(t('labels.notes'))).toBeOnTheScreen();
});

describe('a known use, confirmed with nothing typed', () => {
  // The stack as the sheet reads it: `count` of a counted unit, last used in it.
  const stackOf = (
    unit: { id: string; symbol: string; name: string },
    count: number,
  ) =>
    actionItemCache({
      itemName: 'Stack',
      quantity: count,
      heldQuantity: count,
      stockBreakdown: { __typename: 'StockBreakdown', fullPackages: count },
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity: count,
        localizedSymbol: unit.symbol,
        fraction: null,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: unit.id,
          symbol: unit.symbol,
        }),
      },
      unit: asAbbreviation({
        __typename: 'Unit',
        ...unit,
        type: 'COUNT',
        displayAsFraction: false,
      }),
      consumeUnit: { __typename: 'Unit', id: unit.id },
    });

  it.each([
    // USE-01: 12 eggs, last used two at a time.
    ['USE-01 two eggs', { id: 'u-pc', symbol: 'pc', name: 'Pieces' }, 12, 2],
    // USE-03: six cans of a multipack, one at a time.
    ['USE-03 one can', { id: 'u-can', symbol: 'can', name: 'Cans' }, 6, 1],
  ])('%s', async (_case, unit, count, increment) => {
    const log = operationLog();
    let confirmed!: () => void;
    const called = new Promise<void>(resolve => {
      confirmed = resolve;
    });
    const onConfirm = jest.fn(() => {
      confirmed();
      return Promise.resolve('applied');
    });
    const units = recordMock(ConsumptionUnitsForPantryItemDocument, {
      data: {
        consumptionUnitsForPantryItem: [
          rankedUnit({ ...unit, type: UnitType.Count }, 0, increment),
        ],
      },
    });
    renderWithApollo(
      <ConsumePantryItemModal
        compact
        visible
        pantryItemId={ACTION_ITEM_ID}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
      {
        cache: stackOf(unit, count),
        operationMocks: [units.mock],
        links: [log.link],
      },
    );
    await log.landed(ConsumptionUnitsForPantryItemDocument);

    // The remembered unit and its increment, with no notes asked for.
    expect(screen.getByDisplayValue(String(increment))).toBeOnTheScreen();
    expect(screen.queryByText(t('labels.notes'))).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: t('labels.confirm') }));
    await act(async () => {
      await called;
    });

    expect(onConfirm).toHaveBeenCalledWith({
      quantity: increment,
      all: false,
      purpose: UsagePurpose.General,
      notes: '',
      usageUnitId: unit.id,
    });
  });
});

describe('an amount it cannot use', () => {
  const POUNDS = rankedUnit(
    { id: 'u1', name: 'Pounds', symbol: 'lbs', type: UnitType.Weight },
    0,
  );
  const MORE_THAN_HELD = (amount = '5') =>
    t('deduction.exceedsAvailableConsume', { amount, unit: 'lbs' });

  const onConfirm = jest.fn(() => Promise.resolve('applied'));
  const sheet = (visible = true, over: Partial<Props> = {}) => (
    <ConsumePantryItemModal
      visible={visible}
      pantryItemId={ACTION_ITEM_ID}
      onClose={jest.fn()}
      onConfirm={onConfirm}
      {...over}
    />
  );
  // Three batches, so the stack's draw order has something to explain.
  const open = async (over: Partial<Props> = {}) => {
    const log = operationLog();
    const view = renderWithApollo(sheet(true, over), {
      cache: actionItemCache({ activeBatchCount: 3 }),
      links: [log.link],
      operationMocks: [
        recordMock(ConsumptionUnitsForPantryItemDocument, {
          data: { consumptionUnitsForPantryItem: [POUNDS] },
        }).mock,
      ],
    });
    await log.landed(ConsumptionUnitsForPantryItemDocument);
    return view;
  };
  const typeAmount = (text: string) =>
    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.consumeQuantity),
      text,
    );
  // The form checks the amount as it confirms, asynchronously.
  const confirm = () =>
    userEvent
      .setup()
      .press(screen.getByRole('button', { name: t('labels.confirm') }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('says on the amount field that it is more than is held, not in an alert', async () => {
    await open();

    typeAmount('9');
    await confirm();

    expect(screen.getByText(MORE_THAN_HELD())).toBeOnTheScreen();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // The line under the field said it while typing; once the field does, once.
  it('says it once, on the field', async () => {
    await open();
    typeAmount('9');
    expect(
      screen.getByText(
        t('deduction.exceedsAvailable', { amount: '5', unit: 'lbs' }),
      ),
    ).toBeOnTheScreen();

    await confirm();

    expect(screen.getByText(MORE_THAN_HELD())).toBeOnTheScreen();
    expect(
      screen.queryByText(
        t('deduction.exceedsAvailable', { amount: '5', unit: 'lbs' }),
      ),
    ).toBeNull();
  });

  it('keeps saying so while the amount is still more than is held', async () => {
    await open();
    typeAmount('9');
    await confirm();

    const user = userEvent.setup();
    const field = screen.getByTestId(pantryTestIDs.consumeQuantity);
    await user.clear(field);
    await user.type(field, '7');

    expect(screen.getByText(MORE_THAN_HELD())).toBeOnTheScreen();
  });

  it('opens again on its own amount, with no error left from the last', async () => {
    const view = await open();
    typeAmount('9');
    await confirm();
    expect(screen.getByText(MORE_THAN_HELD())).toBeOnTheScreen();

    view.rerender(sheet(false));
    view.rerender(sheet());

    expect(
      screen.getByTestId(pantryTestIDs.consumeQuantity),
    ).toHaveDisplayValue('1');
    expect(screen.queryByText(MORE_THAN_HELD())).toBeNull();
  });

  describe('from one batch', () => {
    const batch = { quantity: 2, remainingNetWeight: null };

    it('says nothing of the oldest batch going first', async () => {
      await open();
      expect(screen.getByText(t('consumeItem.fifoHint'))).toBeOnTheScreen();

      screen.unmount();
      await open({ batch });

      expect(screen.queryByText(t('consumeItem.fifoHint'))).toBeNull();
    });

    it('says what the batch holds is what is available', async () => {
      await open({ batch });

      expect(
        screen.getByText(
          t('pantryAction.availableAmount', { amount: '2', unit: 'lbs' }),
        ),
      ).toBeOnTheScreen();
    });

    it('holds the amount to what the batch holds', async () => {
      await open({ batch });

      typeAmount('3');
      await confirm();

      expect(screen.getByText(MORE_THAN_HELD('2'))).toBeOnTheScreen();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('uses all the batch holds as all of it', async () => {
      await open({ batch, compact: true });

      fireEvent.press(
        screen.getByRole('button', { name: t('consumeItem.useAll') }),
      );
      expect(
        screen.getByTestId(pantryTestIDs.consumeQuantity),
      ).toHaveDisplayValue('2');
      await confirm();

      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 2, all: true }),
      );
    });
  });
});

describe('the sheet', () => {
  const renderSheet = (pantryItemId: string | null = ACTION_ITEM_ID) =>
    renderWithApollo(
      <ConsumePantryItemModal
        visible
        pantryItemId={pantryItemId}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
      {
        cache: actionItemCache(),
        operationMocks: [
          recordMock(ConsumptionUnitsForPantryItemDocument, {
            data: { consumptionUnitsForPantryItem: [] },
          }).mock,
        ],
      },
    );

  it('is titled for a use, its confirm labelled Confirm', () => {
    renderSheet();
    expect(screen.getByText(t('consumeItem.title'))).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: t('labels.confirm') }),
    ).toBeOnTheScreen();
  });

  it('shows nothing with no stack to use', () => {
    renderSheet(null);
    expect(screen.queryByText(t('consumeItem.title'))).toBeNull();
  });
});

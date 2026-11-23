import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { ConsumePantryItemModal } from '../ConsumePantryItemModal';
import { renderWithApollo, recordMock } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { pantryTestIDs } from '#features/pantry/testIDs';
import {
  ACTION_ITEM_ID,
  actionItemCache,
  rankedUnit,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UnitType, UsagePurpose } from '#/graphql/generated/schemaTypes';
import { operationLog } from '#/test-utils/operationLog';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { t } from '#/i18n';

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
  expect(onConfirm).toHaveBeenCalledWith(5, '5', expect.any(String), '', 'u1');
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

    expect(onConfirm).toHaveBeenCalledWith(
      increment,
      String(increment),
      UsagePurpose.General,
      '',
      unit.id,
    );
  });
});

describe('an amount it cannot use', () => {
  const POUNDS = rankedUnit(
    { id: 'u1', name: 'Pounds', symbol: 'lbs', type: UnitType.Weight },
    0,
  );
  const MORE_THAN_HELD = () =>
    t('deduction.exceedsAvailableConsume', { amount: '5', unit: 'lbs' });

  const onConfirm = jest.fn(() => Promise.resolve('applied'));
  const sheet = (visible = true) => (
    <ConsumePantryItemModal
      visible={visible}
      pantryItemId={ACTION_ITEM_ID}
      onClose={jest.fn()}
      onConfirm={onConfirm}
    />
  );
  const open = async () => {
    const log = operationLog();
    const view = renderWithApollo(sheet(), {
      cache: actionItemCache(),
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
});

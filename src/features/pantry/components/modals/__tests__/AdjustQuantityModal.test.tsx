import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { AdjustQuantityModal } from '#features/pantry/components/modals/AdjustQuantityModal';
import { AdjustQuantityModal_PantryItemFragmentDoc } from '../AdjustQuantityModal.generated';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';
import { t } from '#/i18n';
import { UnitSystem, UnitType } from '#/graphql/generated/schemaTypes';

type Props = React.ComponentProps<typeof AdjustQuantityModal>;

const PANTRY_ITEM_ID = 'pantry-1';

const reading = (
  value: number,
  unitId: string,
  symbol: string,
  type = UnitType.Weight,
) =>
  readingAsAbbreviation({
    __typename: 'MeasureReading',
    value,
    unitId,
    symbol,
    displayAsFraction: false,
    type,
  });

const measure = (
  value: number,
  unitId: string,
  metric: ReturnType<typeof reading>,
  imperial: ReturnType<typeof reading>,
) => ({ __typename: 'Measure', value, unitId, metric, imperial });

// A reading of nothing the stack stores: the sheet reads the stored figure.
const NO_READING = measure(
  0,
  'unit-none',
  reading(0, 'unit-none', ''),
  reading(0, 'unit-none', ''),
);

const grams = asAbbreviation({
  __typename: 'Unit',
  id: 'u-g',
  symbol: 'g',
  displayAsFraction: false,
});

/** Three cups of sugar, as the sheet's own selection holds them. */
function stockedCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      // The production selection the sheet reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: AdjustQuantityModal_PantryItemFragmentDoc,
      data: {
        __typename: 'PantryItem',
        id: PANTRY_ITEM_ID,
        itemName: 'Sugar',
        quantity: 3,
        lastUsedAt: null,
        remainingNetWeight: null,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'u1',
          symbol: 'cups',
          displayAsFraction: false,
        }),
        netWeightUnit: null,
        displayAmount: {
          __typename: 'DisplayAmount',
          quantity: 3,
          localizedSymbol: 'cups',
          fraction: null,
          unit: asAbbreviation({
            __typename: 'Unit',
            id: 'u1',
            symbol: 'cups',
          }),
        },
        amountLeft: NO_READING,
        remaining: null,
        ...overrides,
      },
    },
  ]);
}

// 1360.78 g of honey, which the row reads as "3 lb" for an imperial user.
function honeyCache(overrides: Record<string, unknown> = {}) {
  const cache = stockedCache({
    itemName: 'Honey',
    quantity: 1360.78,
    unit: grams,
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity: 1360.78,
      localizedSymbol: 'g',
      fraction: null,
      unit: asAbbreviation({ __typename: 'Unit', id: 'u-g', symbol: 'g' }),
    },
    amountLeft: measure(
      1360.78,
      'u-g',
      reading(1.36, 'u-kg', 'kg'),
      reading(3, 'u-lb', 'lb'),
    ),
    ...overrides,
  });
  writeUnitSystemSettings(cache, UnitSystem.Imperial, UnitSystem.Imperial);
  return cache;
}

const onClose = jest.fn();
const onConfirm = jest.fn();

const sheet = (over: Partial<Props> = {}) => (
  <AdjustQuantityModal
    visible
    pantryItemId={PANTRY_ITEM_ID}
    onClose={onClose}
    onConfirm={onConfirm}
    {...over}
  />
);

const renderSheet = (cache = stockedCache(), over: Partial<Props> = {}) =>
  renderWithApollo(sheet(over), { cache });

const reasonField = () =>
  screen.getByPlaceholderText(t('adjustQuantity.reasonPlaceholder'));

/** Gives a reason and confirms, as the user does; the form validates first. */
async function adjust(reason = 'Recount') {
  const user = userEvent.setup();
  await user.type(reasonField(), reason);
  await user.press(screen.getByLabelText(t('adjustQuantity.adjust')));
}

async function retype(current: string, next: string) {
  const user = userEvent.setup();
  const field = screen.getByDisplayValue(current);
  await user.clear(field);
  await user.type(field, next);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('opening on a stack', () => {
  it('names it and what it holds now', () => {
    renderSheet();

    expect(screen.getByText(t('adjustQuantity.title'))).toBeTruthy();
    expect(screen.getByText('Sugar')).toBeTruthy();
    expect(screen.getByText(/3 cups/)).toBeTruthy();
  });

  it('opens on nothing when there is no stack', () => {
    renderSheet(stockedCache(), { pantryItemId: null });

    expect(screen.queryByText('Sugar')).toBeNull();
  });

  it.each([
    { unit: 'reads in fractions', displayAsFraction: true, seeded: '1/3' },
    {
      unit: 'opts out of fractions',
      displayAsFraction: false,
      seeded: '0.333',
    },
  ])(
    'seeds the count as a unit that $unit reads it',
    ({ displayAsFraction, seeded }) => {
      renderSheet(
        stockedCache({
          quantity: 0.33333334,
          unit: asAbbreviation({
            __typename: 'Unit',
            id: 'u1',
            symbol: 'cups',
            displayAsFraction,
          }),
        }),
      );

      expect(screen.getByDisplayValue(seeded)).toBeTruthy();
    },
  );

  it('starts over each time it opens', async () => {
    const view = renderSheet();
    await retype('3', '7');

    view.rerender(sheet({ visible: false }));
    view.rerender(sheet());

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });
});

describe('adjusting', () => {
  // The seed rounds to three places, and confirm submits the seed. Sent as
  // is, opening the sheet to record a reason would rewrite the stock.
  it('sends the stored count untouched when it was not changed, and closes', async () => {
    renderSheet(stockedCache({ quantity: 2.7182818 }));

    await adjust('  Recount  ');

    expect(onConfirm).toHaveBeenCalledWith(2.7182818, 'Recount', undefined, {});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends a changed count', async () => {
    renderSheet(stockedCache({ quantity: 2.7182818 }));

    await retype('2.718', '5');
    await adjust();

    expect(onConfirm.mock.calls[0]?.[0]).toBe(5);
  });

  it('asks for a reason on its field before adjusting', async () => {
    renderSheet();

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('adjustQuantity.adjust')));

    expect(screen.getByText(t('adjustQuantity.reasonRequired'))).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Cancel, adjusting nothing', () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText(t('labels.cancel')));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('in the user’s unit system', () => {
  it('opens on the count as the row reads it', () => {
    renderSheet(honeyCache());

    expect(screen.getByText('3 lb')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  // The server converts 2.5 lb onto the gram stack exactly.
  it('sends a recount of 2.5 lb with the pound', async () => {
    renderSheet(honeyCache());

    await retype('3', '2.5');
    await adjust();

    expect(onConfirm.mock.calls[0]).toEqual([
      2.5,
      'Recount',
      undefined,
      { newQuantityUnitId: 'u-lb' },
    ]);
  });

  it('sends the stored grams, and no unit, when the count is unchanged', async () => {
    renderSheet(honeyCache());

    await adjust();

    expect(onConfirm.mock.calls[0]).toEqual([
      1360.78,
      'Recount',
      undefined,
      {},
    ]);
  });
});

describe('the weight left of an opened stack', () => {
  const opened = {
    lastUsedAt: '2026-11-01T10:00:00Z',
    remainingNetWeight: 400,
    netWeightUnit: grams,
  };
  const weightField = () =>
    screen.queryByPlaceholderText(
      t('adjustQuantity.remainingWeightPlaceholder'),
    );

  it('is not asked of a stack nothing was used from', () => {
    renderSheet(
      stockedCache({ remainingNetWeight: 400, netWeightUnit: grams }),
    );

    expect(weightField()).toBeNull();
  });

  it('is sent as typed, in the stack’s own unit', async () => {
    renderSheet(stockedCache(opened));

    await userEvent.setup().type(weightField()!, '300');
    await adjust();

    expect(onConfirm.mock.calls[0]?.[2]).toBe(300);
    expect(onConfirm.mock.calls[0]?.[3]).toEqual({});
  });

  // A weight read in the unit the stack counts in would read as a count.
  it('reads as stored when the reading names the stack’s counting unit', () => {
    const ounces = asAbbreviation({
      __typename: 'Unit',
      id: 'u-oz',
      symbol: 'oz',
      displayAsFraction: false,
    });
    renderSheet(
      honeyCache({
        lastUsedAt: '2026-11-01T10:00:00Z',
        remainingNetWeight: 32,
        netWeightUnit: ounces,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'u-lb',
          symbol: 'lb',
          displayAsFraction: false,
        }),
        remaining: measure(
          32,
          'u-oz',
          reading(907.18, 'u-g', 'g'),
          reading(2, 'u-lb', 'lb'),
        ),
      }),
    );

    expect(screen.getByText(/32 oz/)).toBeTruthy();
  });

  it('reads in the user’s system, and is sent in the unit it reads in', async () => {
    renderSheet(
      honeyCache({
        ...opened,
        remaining: measure(
          400,
          'u-g',
          reading(400, 'u-g', 'g'),
          reading(14.11, 'u-oz', 'oz'),
        ),
      }),
    );
    expect(screen.getByText(/14\.11 oz/)).toBeTruthy();

    await userEvent.setup().type(weightField()!, '10');
    await adjust();

    expect(onConfirm.mock.calls[0]?.[3]).toEqual({
      remainingNetWeightUnitId: 'u-oz',
    });
  });
});

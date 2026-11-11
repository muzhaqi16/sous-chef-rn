import React from 'react';
import { Text } from '#components/atoms/Text';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import type { DocumentNode } from 'graphql';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { PantryActionModal } from '#features/pantry/components/modals/PantryActionModal';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  recordMock,
  renderWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { t } from '#/i18n';
import { UnitSystem, UnitType } from '#/graphql/generated/schemaTypes';
import { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { GetPantryActionItemDocument } from '#features/pantry/components/modals/PantryActionModal.generated';
import type { PantryActionSharedState } from '#features/pantry/types';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import {
  ACTION_ITEM_ID,
  actionItemCache,
  rankedUnit,
  type RankedActionUnit,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { unitLabel } from '#/utils/formatQuantity';

const PANTRY_ITEM_ID = ACTION_ITEM_ID;
const stockedCache = actionItemCache;
const ranked = rankedUnit;

const unitsAnswer = (units: RankedActionUnit[]) =>
  recordMock(ConsumptionUnitsForPantryItemDocument, {
    data: { consumptionUnitsForPantryItem: units },
  });

let log = operationLog();

/** Waits for the operation's nth answer, then lets what it started render. */
const answered = (document: DocumentNode, nth = 1) =>
  act(async () => {
    await log.answered(document, nth);
  });

/** What a consumer's fields last received. */
let lastShared: PantryActionSharedState | undefined;
const shared = () => {
  if (!lastShared) throw new Error('the action fields never rendered');
  return lastShared;
};
const renderActionFields = (state: PantryActionSharedState) => {
  lastShared = state;
  return <Text>Action Fields</Text>;
};

const onClose = jest.fn();
const onConfirm = jest.fn();

type Props = React.ComponentProps<typeof PantryActionModal>;
const modal = (over: Partial<Props> = {}) => (
  <PantryActionModal
    visible
    pantryItemId={PANTRY_ITEM_ID}
    onClose={onClose}
    title="Use some"
    confirmLabel="Use"
    operation={PantryOperation.Consume}
    onConfirm={onConfirm}
    renderActionFields={renderActionFields}
    {...over}
  />
);

/** The modal over the stack the device holds, its units answered. */
function renderModal({
  props = {},
  cache = stockedCache(),
  units = [],
  answers = [],
}: {
  props?: Partial<Props>;
  cache?: ReturnType<typeof stockedCache>;
  units?: RankedActionUnit[];
  answers?: ReturnType<typeof recordMock>[];
} = {}) {
  return renderWithApollo(modal(props), {
    cache,
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      unitsAnswer(units).mock,
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  lastShared = undefined;
  log = operationLog();
});

describe('opening on a stack', () => {
  it('names it and what is left, under its title', () => {
    renderModal();

    expect(screen.getByText('Use some')).toBeTruthy();
    expect(screen.getByText('Flour')).toBeTruthy();
    expect(screen.getByText('Action Fields')).toBeTruthy();
  });

  it('says what is left as the row does, with nothing beside it', () => {
    const reading = {
      __typename: 'MeasureReading',
      value: 9,
      unitId: 'can',
      symbol: 'cans',
      localizedSymbol: 'cans',
      displayAsFraction: false,
      type: 'COUNT',
    };
    renderModal({
      cache: stockedCache({
        remainingNetWeight: 67.5,
        amountLeft: {
          __typename: 'Measure',
          value: 9,
          unitId: 'can',
          metric: reading,
          imperial: reading,
        },
      }),
    });

    expect(screen.getByText('9 cans')).toBeTruthy();
    expect(screen.queryByText(/remaining/)).toBeNull();
  });

  it('says what is left in the user’s unit system', () => {
    const reading = (value: number, unitId: string, symbol: string) => ({
      __typename: 'MeasureReading',
      value,
      unitId,
      symbol,
      localizedSymbol: symbol,
      displayAsFraction: false,
      type: 'WEIGHT',
    });
    const cache = stockedCache({
      amountLeft: {
        __typename: 'Measure',
        value: 2268,
        unitId: 'g',
        metric: reading(2.27, 'kg', 'kg'),
        imperial: reading(5, 'lb', 'lb'),
      },
    });
    writeUnitSystemSettings(cache, UnitSystem.Imperial, UnitSystem.Imperial);
    renderModal({ cache });

    expect(screen.getByText('5 lb')).toBeTruthy();
  });

  it('offers what the stack holds and its unit to the action', () => {
    renderModal();

    expect(shared().trackingQuantity).toBe(5);
    expect(shared().trackingUnitId).toBe('u1');
    expect(unitLabel(shared().activeUnit)).toBe('lbs');
  });

  // A row created offline holds a neutral unit with an empty id. Passed on as
  // the unit a consume is measured in, it would name nothing.
  it('names no unit for a row whose unit is still the offline placeholder', () => {
    renderModal({
      cache: stockedCache({
        unit: asAbbreviation({
          __typename: 'Unit',
          id: '',
          symbol: '',
          name: '',
          type: 'COUNT',
          displayAsFraction: false,
        }),
        displayAmount: {
          __typename: 'DisplayAmount',
          quantity: 5,
          localizedSymbol: '',
          fraction: null,
          unit: asAbbreviation({ __typename: 'Unit', id: '', symbol: '' }),
        },
      }),
    });

    expect(shared().trackingUnitId).toBeUndefined();
    expect(shared().activeUnitId).toBeUndefined();
  });

  it('shows nothing of a stack when there is none, and offers none held', () => {
    renderModal({ props: { pantryItemId: null } });

    fireEvent.press(screen.getByLabelText('Use'));

    expect(screen.queryByText('Flour')).toBeNull();
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ trackingQuantity: 0 }),
    );
  });
});

describe('the header', () => {
  it('closes on Cancel', () => {
    renderModal();

    fireEvent.press(screen.getByLabelText(t('labels.cancel')));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms with what the action was given', () => {
    renderModal();

    fireEvent.press(screen.getByLabelText('Use'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ trackingQuantity: 5, trackingUnitId: 'u1' }),
    );
  });
});

describe('a stack the device does not hold', () => {
  it('waits on it with a spinner', () => {
    renderModal({
      cache: seedCache([]),
      answers: [recordMock(GetPantryActionItemDocument, { held: true })],
    });

    expect(screen.UNSAFE_getByType(ThemedActivityIndicator)).toBeTruthy();
  });

  it('offers to read it again rather than opening empty', async () => {
    const failed = recordMock(GetPantryActionItemDocument, {
      error: new Error('network down'),
    });
    renderModal({ cache: seedCache([]), answers: [failed] });
    await answered(GetPantryActionItemDocument);

    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();

    fireEvent.press(screen.getByText(t('labels.tryAgain')));
    await answered(GetPantryActionItemDocument, 2);
    expect(failed.fired).toHaveLength(2);
  });
});

describe('each time it opens', () => {
  it('starts with no notes, and resets the action', () => {
    const onReset = jest.fn();
    const view = renderModal({ props: { onReset } });
    act(() => shared().setNotes('half a bag'));

    view.rerender(modal({ visible: false, onReset }));
    view.rerender(modal({ onReset }));

    expect(shared().notes).toBe('');
    expect(onReset).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: PANTRY_ITEM_ID }),
      null,
      null,
    );
  });

  it('measures in the unit the server ranks first', async () => {
    const view = renderModal({
      props: { visible: false },
      units: [
        ranked(
          { id: 'oz', symbol: 'oz', name: 'ounce', type: UnitType.Weight },
          1,
        ),
        ranked(
          { id: 'cup', symbol: 'cup', name: 'cup', type: UnitType.Volume },
          0,
        ),
      ],
    });
    await answered(ConsumptionUnitsForPantryItemDocument);

    view.rerender(modal());

    expect(shared().activeUnitId).toBe('cup');
  });

  it('takes the ranked unit once it is read', async () => {
    renderModal({
      units: [
        ranked(
          { id: 'cup', symbol: 'cup', name: 'cup', type: UnitType.Volume },
          0,
        ),
      ],
    });
    expect(shared().activeUnitId).toBe('u1');

    await answered(ConsumptionUnitsForPantryItemDocument);

    expect(shared().activeUnitId).toBe('cup');
  });
});

describe('picking a unit', () => {
  const units = [
    ranked(
      { id: 'u1', symbol: 'lbs', name: 'Pounds', type: UnitType.Weight },
      0,
      1,
    ),
    ranked(
      { id: 'oz', symbol: 'oz', name: 'ounce', type: UnitType.Weight },
      1,
      4,
    ),
  ];

  it('measures in the unit picked, with its own step, as a converted one', async () => {
    renderModal({ units });
    await answered(ConsumptionUnitsForPantryItemDocument);
    expect(shared().isConvertedUnit).toBe(false);

    fireEvent.press(screen.getByRole('button', { name: 'oz' }));

    expect(shared().activeUnitId).toBe('oz');
    expect(shared().defaultIncrement).toBe(4);
    expect(shared().isConvertedUnit).toBe(true);
  });
});

describe('previewing what is left', () => {
  const caseUnit = asAbbreviation({
    __typename: 'Unit',
    id: 'case',
    name: 'case',
    symbol: 'case',
    type: UnitType.Count,
    displayAsFraction: false,
    commonFractions: null,
  });
  const can = asAbbreviation({
    __typename: 'Unit',
    id: 'can',
    name: 'can',
    symbol: 'cans',
  });

  it('reads what a part-used case comes to by the can', () => {
    renderModal({
      cache: stockedCache({
        quantity: 1.6,
        heldQuantity: 1.6,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 1 },
        unit: caseUnit,
        portionUnitId: 'can',
        portionUnit: can,
        portionsPerTrackingUnit: 10,
        remainingPortions: 16,
      }),
    });

    expect(shared().leftAfter(-1)).toMatchObject({
      quantity: 26,
      unit: { symbol: 'cans' },
    });
  });

  it('reads two opened cases by the can, never as a whole case', () => {
    renderModal({
      cache: stockedCache({
        quantity: 2,
        heldQuantity: 1.5,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 0 },
        unit: caseUnit,
        portionUnitId: 'can',
        portionUnit: can,
        portionsPerTrackingUnit: 10,
        remainingPortions: 15,
      }),
    });

    expect(shared().leftAfter(0.5)).toMatchObject({
      quantity: 10,
      unit: { symbol: 'cans' },
    });
  });

  const counted = (id: string) =>
    asAbbreviation({
      __typename: 'Unit',
      id,
      name: id,
      symbol: id,
      type: UnitType.Count,
      displayAsFraction: false,
      commonFractions: null,
    });
  const measured = (id: string, symbol: string) =>
    asAbbreviation({ __typename: 'Unit', id, name: symbol, symbol });

  it('reads a can drawn from a pack that states its volume by the can', () => {
    renderModal({
      cache: stockedCache({
        quantity: 1,
        heldQuantity: 1,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 1 },
        unit: counted('pack'),
        portionUnitId: 'can',
        portionUnit: measured('can', 'cans'),
        portionsPerTrackingUnit: 10,
        remainingPortions: 10,
        netWeight: 2000,
        remainingNetWeight: 2000,
        netWeightUnit: measured('ml', 'mL'),
      }),
    });

    expect(shared().packagesOfNetWeight(200)).toBe(0.1);
    expect(shared().leftAfter(0.1)).toMatchObject({
      quantity: 9,
      unit: { symbol: 'cans' },
    });
  });

  it('reads what a bag drawn by weight leaves in the weight', () => {
    renderModal({
      cache: stockedCache({
        quantity: 1,
        heldQuantity: 1,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 1 },
        unit: counted('bag'),
        netWeight: 5,
        remainingNetWeight: 5,
        netWeightUnit: measured('lb', 'lb'),
      }),
    });

    expect(shared().leftAfter(0.8)).toMatchObject({
      quantity: 1,
      unit: { symbol: 'lb' },
    });
  });
});

describe('a stack of pieces shown in dozens', () => {
  const eggs = {
    itemName: 'Eggs',
    quantity: 36,
    heldQuantity: 36,
    stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 36 },
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity: 3,
      localizedSymbol: 'doz',
      fraction: null,
      unit: asAbbreviation({ __typename: 'Unit', id: 'doz', symbol: 'doz' }),
    },
    unit: asAbbreviation({
      __typename: 'Unit',
      id: 'pc',
      symbol: 'pc',
      name: 'piece',
      type: 'COUNT',
      displayAsFraction: false,
    }),
    displayUnit: asAbbreviation({
      __typename: 'Unit',
      id: 'doz',
      symbol: 'doz',
      type: 'COUNT',
      hasStandardCountFactor: true,
      baseUnitId: 'pc',
      conversionFactor: 12,
      commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
    }),
  };
  const dozen = ranked(
    {
      id: 'doz',
      symbol: 'doz',
      name: 'dozen',
      type: UnitType.Count,
      hasStandardCountFactor: true,
      baseUnitId: 'pc',
      conversionFactor: 12,
    },
    0,
  );

  it('previews a held amount as the stack shows it', () => {
    renderModal({ cache: stockedCache(eggs) });

    expect(shared().leftAfter(12)).toEqual({
      quantity: 2,
      unit: expect.objectContaining({ symbol: 'doz' }),
      displayAsFraction: null,
    });
    expect(shared().leftAfter(25)).toEqual({
      quantity: 11,
      unit: expect.objectContaining({ symbol: 'pc' }),
      displayAsFraction: false,
    });
  });

  it('needs no conversion in pieces', () => {
    renderModal({ cache: stockedCache(eggs) });

    expect(shared().exactFactor).toBe(1);
  });

  it('needs no conversion in dozens, which count 12 pieces each', async () => {
    renderModal({ cache: stockedCache(eggs), units: [dozen] });
    await answered(ConsumptionUnitsForPantryItemDocument);

    expect(shared().activeUnitId).toBe('doz');
    expect(shared().exactFactor).toBe(12);
  });

  it('converts on a stack also weighed, whose count moves by whole packages', async () => {
    renderModal({
      cache: stockedCache({
        ...eggs,
        netWeight: 50,
        netWeightUnit: asAbbreviation({
          __typename: 'Unit',
          id: 'g',
          name: 'gram',
          symbol: 'g',
        }),
      }),
      units: [dozen],
    });
    await answered(ConsumptionUnitsForPantryItemDocument);

    expect(shared().activeUnitId).toBe('doz');
    expect(shared().exactFactor).toBeNull();
  });
});

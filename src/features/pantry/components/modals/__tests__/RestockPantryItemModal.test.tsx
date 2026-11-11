import React from 'react';
import type { DocumentNode } from 'graphql';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { RestockPantryItemModal } from '#features/pantry/components/modals/RestockPantryItemModal';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  ACTION_ITEM_ID,
  actionItemCache,
  rankedUnit,
  type RankedActionUnit,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { useStore } from '#store';
import { t } from '#/i18n';
import { localizeNumericHint } from '#/utils/formatters/number';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { RestockUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { SearchUnitsDocument } from '#operations/item/unit.generated';
import { pantryTestIDs } from '#features/pantry/testIDs';

type Props = React.ComponentProps<typeof RestockPantryItemModal>;

const POUNDS = rankedUnit(
  { id: 'u1', symbol: 'lbs', name: 'Pounds', type: UnitType.Weight },
  0,
);

/** A case of cans, counted in cases. */
const caseOfCans = {
  unit: asAbbreviation({
    __typename: 'Unit',
    id: 'case',
    name: 'case',
    symbol: 'case',
    type: UnitType.Count,
    displayAsFraction: false,
    commonFractions: null,
  }),
};
const CASE = rankedUnit(
  { id: 'case', symbol: 'case', name: 'case', type: UnitType.Count },
  0,
);
const CAN = rankedUnit(
  { id: 'can', symbol: 'can', name: 'can', type: UnitType.Count },
  1,
);

type SearchedUnit = NonNullable<
  MockDataFor<typeof SearchUnitsDocument>['searchUnits']
>[number];

/** What the unit search finds: a pound, and a can. */
const SEARCHED: SearchedUnit[] = [
  {
    ...asAbbreviation({
      __typename: 'Unit',
      id: 'lb',
      name: 'pound',
      symbol: 'lb',
      type: UnitType.Weight,
    }),
    localizedNameForms: {
      __typename: 'PluralForms',
      one: 'pound',
      other: 'pounds',
    },
  },
  {
    ...asAbbreviation({
      __typename: 'Unit',
      id: 'can',
      name: 'can',
      symbol: 'can',
      type: UnitType.Count,
    }),
    localizedNameForms: {
      __typename: 'PluralForms',
      one: 'can',
      other: 'cans',
    },
  },
];

let log = operationLog();

/** Waits for the operation's nth answer, then lets what it started render. */
const answered = (document: DocumentNode, nth = 1) =>
  act(async () => {
    await log.answered(document, nth);
  });

const onClose = jest.fn();
const onConfirm = jest.fn<
  ReturnType<Props['onConfirm']>,
  Parameters<Props['onConfirm']>
>(() => Promise.resolve(null));

const sheet = (over: Partial<Props> = {}) => (
  <RestockPantryItemModal
    visible
    pantryItemId={ACTION_ITEM_ID}
    onClose={onClose}
    onConfirm={onConfirm}
    {...over}
  />
);

/** The sheet over the stack the device holds, once its units are read. */
async function openRestock({
  props = {},
  item = {},
  units = [POUNDS],
}: {
  props?: Partial<Props>;
  item?: Record<string, unknown>;
  units?: RankedActionUnit[];
} = {}) {
  const view = renderWithApollo(sheet(props), {
    cache: actionItemCache(item),
    links: [log.link],
    operationMocks: [
      recordMock(RestockUnitsForPantryItemDocument, {
        data: { restockUnitsForPantryItem: units },
      }).mock,
      recordMock(SearchUnitsDocument, {
        dataFor: ({ query }) => ({
          searchUnits: SEARCHED.filter(
            unit => typeof query === 'string' && !!unit.name?.startsWith(query),
          ),
        }),
      }).mock,
    ],
  });
  await answered(RestockUnitsForPantryItemDocument);
  return view;
}

/**
 * A field, by the label a user reads above it: its wrapper, which holds the
 * error. A `FormInput` labels its input as well, after the wrapper.
 */
const field = (label: string) => {
  const [wrapper] = screen.getAllByLabelText(label);
  if (!wrapper) throw new Error(`no field labelled ${label}`);
  return wrapper;
};
const QUANTITY = () => t('restockItem.quantityToAdd');
const COST_PER_UNIT = () => t('restockItem.costPerUnit');
const TOTAL_PAID = () => t('labels.totalPaid');

const typeInto = (label: string, placeholder: string, text: string) =>
  fireEvent.changeText(
    within(field(label)).getByPlaceholderText(placeholder),
    text,
  );

const typeQuantity = (text: string) =>
  typeInto(QUANTITY(), localizeNumericHint(t('labels.eG1114Or15')), text);
const typeCost = (label: string, text: string) =>
  typeInto(label, localizeNumericHint('0.00'), text);

const confirm = () =>
  fireEvent.press(screen.getByLabelText(t('labels.restock')));

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    budgetAndPrices: true,
    cachedUnits: [],
    lastUnitsFetchedAt: Date.now(),
  });
});

describe('restocking', () => {
  it('restocks one of the stack’s own unit, and closes', async () => {
    await openRestock();

    confirm();

    expect(onConfirm).toHaveBeenCalledWith(
      1,
      '1',
      '',
      'u1',
      undefined,
      undefined,
      null,
      null,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends what was paid, the notes and the expiry', async () => {
    await openRestock();

    typeQuantity('2');
    typeCost(TOTAL_PAID(), '3.49');
    typeInto(t('labels.notes'), t('restockItem.notesPlaceholder'), 'on sale');
    fireEvent.press(screen.getByText(t('restockItem.expirationPlaceholder')));
    const [day20] = screen.getAllByText('20');
    if (!day20) throw new Error('the calendar shows no 20th');
    fireEvent.press(day20);
    confirm();

    const [quantity, , notes, , costPerUnit, totalCost, expiresAt] =
      onConfirm.mock.calls[0] ?? [];
    expect({ quantity, notes, costPerUnit, totalCost }).toEqual({
      quantity: 2,
      notes: 'on sale',
      costPerUnit: undefined,
      totalCost: 3.49,
    });
    expect(expiresAt?.getDate()).toBe(20);
  });

  it('starts fresh each time it opens', async () => {
    const view = await openRestock();
    typeQuantity('3');
    typeCost(COST_PER_UNIT(), '1.25');
    typeCost(TOTAL_PAID(), '3.75');

    view.rerender(sheet({ visible: false }));
    view.rerender(sheet());

    expect(
      within(field(QUANTITY())).getByPlaceholderText(
        localizeNumericHint(t('labels.eG1114Or15')),
      ),
    ).toHaveDisplayValue('1');
    expect(screen.queryByDisplayValue('1.25')).toBeNull();
    expect(screen.queryByDisplayValue('3.75')).toBeNull();
  });

  describe('opened with a reason the amount is asked', () => {
    const REASON = "We don't know how much one package of this holds.";

    it('says it on the amount until the amount is edited', async () => {
      await openRestock({ props: { reason: REASON } });
      expect(within(field(QUANTITY())).getByText(REASON)).toBeTruthy();

      typeQuantity('2');

      expect(within(field(QUANTITY())).queryByText(REASON)).toBeNull();
    });
  });
});

describe('an entry that cannot be restocked', () => {
  const INVALID_PAID = () => t('errors.invalidAmountPaid');

  // Negatives were sent as typed, and `4,99x` was read as 4.99.
  it.each([
    { label: TOTAL_PAID, typed: '-3' },
    { label: TOTAL_PAID, typed: '4,99x' },
    { label: COST_PER_UNIT, typed: '-3' },
  ])(
    'refuses $typed paid on its field, and restocks nothing',
    async ({ label, typed }) => {
      await openRestock();

      typeCost(label(), typed);
      confirm();

      expect(within(field(label())).getByText(INVALID_PAID())).toBeTruthy();
      expect(onConfirm).not.toHaveBeenCalled();
    },
  );

  it('reports an unusable amount on its field, not through an alert', async () => {
    await openRestock();

    typeQuantity('0');
    confirm();

    expect(
      within(field(QUANTITY())).getByText(t('errors.invalidQuantity')),
    ).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('says nothing before a confirm, and clears once fixed', async () => {
    await openRestock();

    typeCost(TOTAL_PAID(), '-3');
    expect(within(field(TOTAL_PAID())).queryByText(INVALID_PAID())).toBeNull();
    confirm();
    typeCost(TOTAL_PAID(), '3.49');

    expect(within(field(TOTAL_PAID())).queryByText(INVALID_PAID())).toBeNull();
  });
});

describe('with budget & prices off', () => {
  beforeEach(() => useStore.setState({ budgetAndPrices: false }));

  it('asks for no cost, and sends none', async () => {
    await openRestock();

    expect(screen.queryByLabelText(COST_PER_UNIT())).toBeNull();
    expect(screen.queryByLabelText(TOTAL_PAID())).toBeNull();
    confirm();

    const [, , , , costPerUnit, totalCost] = onConfirm.mock.calls[0] ?? [];
    expect({ costPerUnit, totalCost }).toEqual({
      costPerUnit: undefined,
      totalCost: undefined,
    });
  });
});

describe('a package of a different size', () => {
  const openCase = (units = [CASE, CAN]) =>
    openRestock({ item: caseOfCans, units });
  const askSize = () =>
    fireEvent.press(screen.getByTestId(pantryTestIDs.restockDifferentSize));
  const EACH_HOLDS = () => t('packageSize.eachHolds');
  const typeSize = (text: string) =>
    typeInto(EACH_HOLDS(), localizeNumericHint(t('labels.eG145')), text);
  /** Types a unit for the size and picks it from the search. */
  const pickSizeUnit = async (typed: string, name: string) => {
    fireEvent.changeText(
      screen.getByPlaceholderText(t('packageSize.unitPlaceholder')),
      typed,
    );
    await log.requested(SearchUnitsDocument);
    await answered(SearchUnitsDocument);
    fireEvent.press(screen.getByText(name));
  };

  it('is not offered on a stack held in a measure', async () => {
    await openRestock();

    expect(screen.queryByTestId(pantryTestIDs.restockDifferentSize)).toBeNull();
  });

  it('is not offered while another unit is picked', async () => {
    await openCase();

    fireEvent.press(screen.getByRole('button', { name: 'can' }));

    expect(screen.queryByTestId(pantryTestIDs.restockDifferentSize)).toBeNull();
  });

  it('asks nothing until it is pressed', async () => {
    await openCase();

    expect(screen.queryByLabelText(EACH_HOLDS())).toBeNull();

    askSize();
    expect(field(EACH_HOLDS())).toBeTruthy();
  });

  it('stays the stack’s own restock when no size is typed', async () => {
    await openCase();

    askSize();
    confirm();

    expect(onConfirm.mock.calls[0]?.[7]).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends a measure as the new package’s size', async () => {
    await openCase();
    askSize();
    typeSize('3');
    await pickSizeUnit('pou', 'pound');

    await act(async () => confirm());

    expect(onConfirm.mock.calls[0]?.[7]).toStrictEqual({
      packageSize: { netWeight: 3, netWeightUnitId: 'lb' },
    });
  });

  it('keeps a count in the stack’s portion unit on the batch', async () => {
    await openRestock({
      item: {
        ...caseOfCans,
        portionUnitId: 'can',
        portionUnit: asAbbreviation({
          __typename: 'Unit',
          id: 'can',
          name: 'can',
          symbol: 'can',
        }),
        portionsPerTrackingUnit: 12,
        remainingPortions: 60,
      },
      units: [CASE],
    });
    askSize();
    typeSize('12');
    await pickSizeUnit('can', 'can');

    await act(async () => confirm());

    expect(onConfirm.mock.calls[0]?.[7]).toStrictEqual({
      packageSize: null,
      packagePortions: 12,
    });
  });

  it('stays open on a refused size and says why on the field', async () => {
    onConfirm.mockResolvedValueOnce('Use a weight here.');
    await openCase();
    askSize();
    typeSize('3');
    await pickSizeUnit('pou', 'pound');

    await act(async () => confirm());

    expect(
      within(field(EACH_HOLDS())).getByText('Use a weight here.'),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    typeSize('4');
    expect(
      within(field(EACH_HOLDS())).queryByText('Use a weight here.'),
    ).toBeNull();
  });

  it('sends one restock while the answer is on its way', async () => {
    let answer: (refusal: string | null) => void = () => undefined;
    onConfirm.mockReturnValueOnce(
      new Promise(resolve => {
        answer = resolve;
      }),
    );
    await openCase();
    askSize();
    typeSize('3');
    await pickSizeUnit('pou', 'pound');

    confirm();
    confirm();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => answer(null));
  });

  it('takes whole packages once a size is stated', async () => {
    await openCase();
    askSize();
    typeSize('3');
    await pickSizeUnit('pou', 'pound');

    typeQuantity('1.5');
    confirm();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      within(field(QUANTITY())).getByText(t('packageSize.wholePackages')),
    ).toBeTruthy();
  });

  it('asks for the size’s unit on its field', async () => {
    await openCase();
    askSize();
    typeSize('3');

    confirm();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(t('packageSize.unitRequired'))).toBeTruthy();
  });
});

describe('a stack of pieces shown in dozens', () => {
  const eggs = (pieces: number) => ({
    itemName: 'Eggs',
    quantity: pieces,
    heldQuantity: pieces,
    stockBreakdown: { __typename: 'StockBreakdown', fullPackages: pieces },
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity: pieces / 12,
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
  });
  const DOZEN = rankedUnit(
    {
      id: 'doz',
      symbol: 'doz',
      name: 'dozen',
      type: UnitType.Count,
      hasStandardCountFactor: true,
      baseUnitId: 'pc',
      conversionFactor: 12,
      commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
    },
    0,
  );

  it('reads the new total in dozens when it is a common fraction of one', async () => {
    await openRestock({ item: eggs(36), units: [DOZEN] });

    expect(
      screen.getByText(`${t('restockItem.newQuantityPrefix')}4 doz`),
    ).toBeTruthy();
  });

  it('reads any other total in pieces, never a decimal of a dozen', async () => {
    await openRestock({ item: eggs(11), units: [DOZEN] });

    expect(
      screen.getByText(`${t('restockItem.newQuantityPrefix')}23 pc`),
    ).toBeTruthy();
  });

  it('takes a quick fraction of a dozen as the amount', async () => {
    await openRestock({
      item: eggs(36),
      units: [{ ...DOZEN, commonFractions: [1 / 2] }],
    });

    fireEvent.press(screen.getByText('1/2 doz'));

    expect(
      within(field(QUANTITY())).getByPlaceholderText(
        localizeNumericHint(t('labels.eG1114Or15')),
      ),
    ).toHaveDisplayValue('1/2');
  });
});

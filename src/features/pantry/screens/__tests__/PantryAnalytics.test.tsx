'use no memo';

import React from 'react';
import { RefreshControl } from 'react-native';

import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import { UNKNOWN_AMOUNT } from '#/utils/formatters/number';
import { DateRange, PeriodGranularity } from '#/graphql/generated/schemaTypes';
import {
  GetPantryLedgerAnalyticsDocument,
  GetPantryUsageAnalyticsDocument,
  GetPantryWasteAnalyticsDocument,
} from '#features/pantry/graphql/pantry.generated';
import { PantryAnalytics } from '../PantryAnalytics';

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

type UsageAnswer = MockDataFor<typeof GetPantryUsageAnalyticsDocument>;
type WasteAnswer = MockDataFor<typeof GetPantryWasteAnalyticsDocument>;
type LedgerAnswer = MockDataFor<typeof GetPantryLedgerAnalyticsDocument>;
type Waste = NonNullable<NonNullable<WasteAnswer['pantry']>['wasteAnalytics']>;
type Ledger = NonNullable<
  NonNullable<LedgerAnswer['pantry']>['ledgerAnalytics']
>;
type Summary = NonNullable<Ledger['summary']>;
type Costs = NonNullable<Ledger['costAnalytics']>;

const usage = (): UsageAnswer => ({
  pantry: {
    id: 'p1',
    usageAnalytics: {
      totalUsageCount: 42,
      averageUsagePerDay: 2.5,
      usageTrend: [],
      usageByPurpose: [],
      usageBySource: [],
      topUsedItems: [],
    },
  },
});

/** A period's waste: nothing costed, nothing listed, unless stated. */
const waste = (stated: Waste = {}): WasteAnswer => ({
  pantry: {
    id: 'p1',
    wasteAnalytics: {
      totalWasteCount: 5,
      wasteRate: 10.5,
      valueByCurrency: [],
      composted: 0,
      recycled: 1.5,
      wasteTrend: [],
      wasteByReason: [],
      topWastedItems: [],
      ...stated,
    },
  },
});

/** A period's ledger: no movement, no cost, unless stated. */
const ledger = ({
  summary = {},
  ...stated
}: Omit<Ledger, 'summary'> & { summary?: Summary } = {}): LedgerAnswer => ({
  pantry: {
    id: 'p1',
    ledgerAnalytics: {
      summary: {
        totalAdded: 0,
        totalConsumed: 0,
        totalWasted: 0,
        netQuantity: 0,
        additionCount: 0,
        consumptionCount: 0,
        additionsByUnit: [],
        consumptionByUnit: [],
        ...summary,
      },
      periodData: [],
      costAnalytics: null,
      topRestockedItems: [],
      ...stated,
    },
  },
});

type Spent = NonNullable<Costs['totalSpent']>[number];
type UnitCost = NonNullable<Costs['averageCostPerUnit']>[number];

const spent = (amount: number, currencyCode: string): Spent => ({
  __typename: 'CurrencyAmount',
  amount,
  currencyCode,
});

const unitCost = (
  amount: number,
  currencyCode: string,
  unitSymbol: string | null,
): UnitCost => ({
  __typename: 'UnitCostAverage',
  amount,
  currencyCode,
  unitSymbol,
  unit: null,
});

let log = operationLog();

interface Open {
  ledgerAnswer?: LedgerAnswer;
  wasteAnswer?: WasteAnswer;
  /** Answers that take precedence over the period's. */
  answers?: ReturnType<typeof recordMock>[];
}

/** The screen once every tab's period has been read. */
async function openAnalytics({
  ledgerAnswer = ledger(),
  wasteAnswer = waste(),
  answers = [],
}: Open = {}) {
  const reads = {
    usage: recordMock(GetPantryUsageAnalyticsDocument, { data: usage() }),
    waste: recordMock(GetPantryWasteAnalyticsDocument, { data: wasteAnswer }),
    ledger: recordMock(GetPantryLedgerAnalyticsDocument, {
      data: ledgerAnswer,
    }),
  };
  renderWithApollo(<PantryAnalytics route={{ params: { pantryId: 'p1' } }} />, {
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      reads.usage.mock,
      reads.waste.mock,
      reads.ledger.mock,
    ],
  });
  await log.landed(GetPantryUsageAnalyticsDocument);
  await log.landed(GetPantryWasteAnalyticsDocument);
  await log.landed(GetPantryLedgerAnalyticsDocument);
  return reads;
}

const openTab = (title: string) =>
  fireEvent.press(screen.getByRole('tab', { name: title }));

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    budgetAndPrices: true,
  });
});

describe('the screen', () => {
  it('reads the pantry it was opened on, over the last month', async () => {
    const reads = await openAnalytics();

    expect(reads.usage.fired).toEqual([
      {
        pantryId: 'p1',
        filter: { dateRange: DateRange.LastMonth, topItemsLimit: 10 },
      },
    ]);
  });

  it('reads every tab again over a picked range', async () => {
    const reads = await openAnalytics();

    fireEvent.press(screen.getByText(t('dateRange.week')));
    await log.landed(GetPantryLedgerAnalyticsDocument, 2);

    for (const read of [reads.usage, reads.waste, reads.ledger]) {
      expect(read.fired.at(-1)).toMatchObject({
        filter: { dateRange: DateRange.LastWeek },
      });
    }
  });

  it('refreshes every tab on a pull', async () => {
    await openAnalytics();

    act(() => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await log.landed(GetPantryUsageAnalyticsDocument, 2);
    await log.landed(GetPantryWasteAnalyticsDocument, 2);
    await log.landed(GetPantryLedgerAnalyticsDocument, 2);
  });

  it('titles its three tabs', async () => {
    await openAnalytics();

    for (const title of [
      t('labels.usage'),
      t('pantryAnalytics.tabWaste'),
      t('pantryAnalytics.tabLedger'),
    ]) {
      expect(screen.getByRole('tab', { name: title })).toBeTruthy();
    }
  });
});

describe('usage', () => {
  it('shows how much was used, and how much a day', async () => {
    await openAnalytics();

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('2.5')).toBeTruthy();
  });

  it('says a failed read failed, never that nothing was used', async () => {
    await openAnalytics({
      answers: [
        recordMock(GetPantryUsageAnalyticsDocument, {
          error: new Error('500'),
        }),
      ],
    });

    expect(screen.queryByText(t('labels.noDataAvailable'))).toBeNull();
  });
});

describe('offline', () => {
  beforeEach(() => useStore.setState({ apiReachable: false }));

  const failed = () => [
    recordMock(GetPantryUsageAnalyticsDocument, {
      error: new Error('offline'),
    }),
    recordMock(GetPantryWasteAnalyticsDocument, {
      error: new Error('offline'),
    }),
    recordMock(GetPantryLedgerAnalyticsDocument, {
      error: new Error('offline'),
    }),
  ];

  it.each([
    { tab: 'usage', title: () => t('labels.usage') },
    { tab: 'waste', title: () => t('pantryAnalytics.tabWaste') },
    { tab: 'ledger', title: () => t('pantryAnalytics.tabLedger') },
  ])('says the $tab tab needs a connection, never zeros', async ({ title }) => {
    await openAnalytics({ answers: failed() });

    openTab(title());

    expect(screen.getByText(t('pantryAnalytics.offlineTitle'))).toBeTruthy();
  });
});

describe('waste', () => {
  it('shows how much was wasted, and at what rate', async () => {
    await openAnalytics();

    openTab(t('pantryAnalytics.tabWaste'));

    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('10.5%')).toBeTruthy();
    expect(screen.getByText('1.5')).toBeTruthy();
  });

  it('shows the value lost in each currency apart, never added together', async () => {
    await openAnalytics({
      wasteAnswer: waste({
        valueByCurrency: [spent(12.5, 'USD'), spent(3.1, 'EUR')],
      }),
    });

    openTab(t('pantryAnalytics.tabWaste'));

    expect(screen.getByText('$12.50 · €3.10')).toBeTruthy();
  });

  it('shows an unknown value lost, never zero, when nothing wasted was costed', async () => {
    await openAnalytics();

    openTab(t('pantryAnalytics.tabWaste'));

    expect(screen.getByText(UNKNOWN_AMOUNT)).toBeTruthy();
  });

  it('names what each top wasted item cost', async () => {
    await openAnalytics({
      wasteAnswer: waste({
        topWastedItems: [
          { itemName: 'Milk', count: 2, valueByCurrency: [spent(4, 'USD')] },
        ],
      }),
    });

    openTab(t('pantryAnalytics.tabWaste'));

    expect(screen.getByText(/\$4\.00/)).toBeTruthy();
  });
});

describe('the ledger', () => {
  it('shows each movement, and the net change', async () => {
    await openAnalytics({
      ledgerAnswer: ledger({
        summary: {
          totalAdded: 100,
          netQuantity: -8,
          additionCount: 50,
          consumptionCount: 40,
        },
      }),
    });

    openTab(t('pantryAnalytics.tabLedger'));

    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('-8')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('reads the ledger again by a picked period', async () => {
    const reads = await openAnalytics();
    openTab(t('pantryAnalytics.tabLedger'));

    fireEvent.press(screen.getByText(t('labels.monthly')));
    await log.landed(GetPantryLedgerAnalyticsDocument, 2);

    expect(reads.ledger.fired.at(-1)).toMatchObject({
      granularity: PeriodGranularity.Monthly,
    });
  });

  // `periodLabel` is the API's bucket key, formatted as a local date.
  it.each([
    {
      by: 'week',
      granularity: PeriodGranularity.Weekly,
      label: '2024-01-08',
      shown: 'Jan 8',
    },
    {
      by: 'month',
      granularity: PeriodGranularity.Monthly,
      label: '2024-01',
      shown: 'Jan 2024',
    },
  ])('labels each period by its $by', async ({ granularity, label, shown }) => {
    const period = { periodLabel: label, added: 5, consumed: 3, wasted: 1 };
    await openAnalytics({
      answers: [
        recordMock(GetPantryLedgerAnalyticsDocument, {
          match: vars => vars.granularity === granularity,
          data: ledger({ periodData: [period] }),
        }),
      ],
    });
    openTab(t('pantryAnalytics.tabLedger'));
    if (granularity === PeriodGranularity.Monthly) {
      fireEvent.press(screen.getByText(t('labels.monthly')));
      await log.landed(GetPantryLedgerAnalyticsDocument, 2);
    }

    expect(screen.getByText(shown)).toBeTruthy();
    expect(screen.queryByText(label)).toBeNull();
  });

  it('reads each quantity as the formatter does', async () => {
    await openAnalytics({
      ledgerAnswer: ledger({
        summary: {
          totalAdded: 1.25,
          totalConsumed: 3.14159,
          totalWasted: 0.33333334,
          netQuantity: -177.4412,
          additionsByUnit: [
            {
              unitId: 'u1',
              unitSymbol: 'g',
              unitName: 'Grams',
              unit: null,
              totalQuantity: 1500,
              count: 3,
            },
          ],
        },
      }),
    });

    openTab(t('pantryAnalytics.tabLedger'));

    expect(screen.getByText('1 1/4')).toBeTruthy();
    expect(screen.getByText('3.142')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('-177.441')).toBeTruthy();
    expect(screen.getByText(t('pantryAnalytics.additionsByUnit'))).toBeTruthy();
    expect(screen.getByText('1.5 kg')).toBeTruthy();
  });

  describe('what it cost', () => {
    const openCosts = async (costs: Costs | null) => {
      await openAnalytics({
        ledgerAnswer: ledger({
          costAnalytics: costs && { costByStore: [], ...costs },
        }),
      });
      openTab(t('pantryAnalytics.tabLedger'));
    };
    const avgCostPerUnit = () => t('labels.avgCostPerUnit');
    const perUnit = (unit: string) => t('pantryAnalytics.perUnit', { unit });

    it('shows a spend in two currencies as two amounts, never one total', async () => {
      await openCosts({
        totalSpent: [spent(45.99, 'USD'), spent(12, 'EUR')],
        averageCostPerUnit: [],
      });

      expect(screen.getByText('$45.99 · €12.00')).toBeTruthy();
    });

    it('shows an unknown spend, never zero, when nothing was costed', async () => {
      await openCosts({ totalSpent: [], averageCostPerUnit: [] });

      expect(screen.getByText(UNKNOWN_AMOUNT)).toBeTruthy();
      expect(screen.queryByText(avgCostPerUnit())).toBeNull();
    });

    it('shows the one average on a card that names its unit', async () => {
      await openCosts({
        totalSpent: [spent(45.99, 'USD')],
        averageCostPerUnit: [unitCost(4.6, 'USD', 'kg')],
      });

      expect(screen.getAllByText(avgCostPerUnit())).toHaveLength(1);
      expect(screen.getByText('$4.60')).toBeTruthy();
      expect(screen.getByText(perUnit('kg'))).toBeTruthy();
    });

    // A kilogram and a piece do not average: no single figure on a card.
    it('lists several averages apart, each with its unit, instead of one card', async () => {
      await openCosts({
        totalSpent: [spent(45.99, 'USD')],
        averageCostPerUnit: [
          unitCost(4.6, 'USD', 'kg'),
          unitCost(0.5, 'USD', 'pc'),
        ],
      });

      expect(screen.getAllByText(avgCostPerUnit())).toHaveLength(1);
      expect(screen.getAllByText('$4.60')).toHaveLength(1);
      expect(screen.getByText('$0.50')).toBeTruthy();
      expect(screen.getByText(perUnit('pc'))).toBeTruthy();
    });
  });
});

describe('with budget & prices off', () => {
  beforeEach(() => useStore.setState({ budgetAndPrices: false }));

  it('shows no spend or cost in the ledger, and still its movements', async () => {
    await openAnalytics({
      ledgerAnswer: ledger({
        summary: { additionCount: 50 },
        costAnalytics: {
          costByStore: [],
          totalSpent: [spent(45.99, 'USD')],
          averageCostPerUnit: [unitCost(4.6, 'USD', 'kg')],
        },
      }),
    });

    openTab(t('pantryAnalytics.tabLedger'));

    expect(screen.queryByText(t('labels.totalSpent'))).toBeNull();
    expect(screen.queryByText(/45\.99|4\.60/)).toBeNull();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('shows no value lost in the waste tab, and still what was wasted', async () => {
    await openAnalytics({
      wasteAnswer: waste({
        valueByCurrency: [spent(12.5, 'USD')],
        topWastedItems: [
          { itemName: 'Milk', count: 2, valueByCurrency: [spent(4, 'USD')] },
        ],
      }),
    });

    openTab(t('pantryAnalytics.tabWaste'));

    expect(screen.queryByText(t('pantryAnalytics.estValueLost'))).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.getByText(/Milk/)).toBeTruthy();
  });
});

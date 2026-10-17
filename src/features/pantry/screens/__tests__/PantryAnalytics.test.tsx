'use no memo';

import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { t } from '#/i18n';
import { UNKNOWN_AMOUNT } from '#/utils/formatters/number';
import type { usePantryAnalytics } from '#features/pantry/hooks/usePantryAnalytics';
import { PantryAnalytics } from '../PantryAnalytics';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/pantry/hooks/usePantryAnalytics', () => ({
  usePantryAnalytics: () => ({
    usageData: {
      totalUsageCount: 42,
      averageUsagePerDay: 2.5,
      usageTrend: [],
      usageByPurpose: [{ purpose: 'COOKING', count: 30, percentage: 71 }],
      usageBySource: [{ source: 'MANUAL', count: 42, percentage: 100 }],
      topUsedItems: [{ itemName: 'Eggs', count: 15 }],
    },
    wasteData: {
      totalWasteCount: 5,
      wasteRate: 10.5,
      valueByCurrency: [
        { currencyCode: 'USD', amount: 12.5 },
        { currencyCode: 'EUR', amount: 3.1 },
      ],
      composted: 2.0,
      recycled: 1.5,
      wasteTrend: [],
      wasteByReason: [{ reason: 'EXPIRED', count: 3, percentage: 60 }],
      topWastedItems: [
        {
          itemName: 'Lettuce',
          count: 2,
          valueByCurrency: [{ currencyCode: 'USD', amount: 4.0 }],
        },
      ],
    },
    ledgerData: {
      summary: {
        totalAdded: 100,
        totalConsumed: 80,
        totalWasted: 5,
        netQuantity: 15,
        additionCount: 50,
        consumptionCount: 40,
        additionsByUnit: [],
        consumptionByUnit: [],
      },
      periodData: [],
      costAnalytics: null,
      topRestockedItems: [],
    },
    usageLoading: false,
    wasteLoading: false,
    ledgerLoading: false,
    usageError: null,
    wasteError: null,
    ledgerError: null,
    dateRange: '7d',
    setDateRange: jest.fn(),
    ledgerGranularity: 'WEEKLY',
    setLedgerGranularity: jest.fn(),
    refetch: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({
    title,
  }: React.ComponentProps<
    typeof import('#components/organisms/Header').Header
  >) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
      </View>
    );
  },
}));
jest.mock('#features/pantry/components/analytics/DateRangeFilter', () => ({
  DateRangeFilter: () => {
    const { View } = require('react-native');
    return <View testID="date-range-filter" />;
  },
}));
jest.mock('#features/pantry/components/analytics/AnalyticsSummaryCard', () => ({
  AnalyticsSummaryCard: ({
    title,
    value,
    subtitle,
  }: React.ComponentProps<
    typeof import('#features/pantry/components/analytics/AnalyticsSummaryCard').AnalyticsSummaryCard
  >) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="summary-card">
        <Text>{title}</Text>
        <Text>{String(value)}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    );
  },
}));
jest.mock('#features/pantry/components/analytics/ChartSection', () => ({
  ChartSection: ({
    title,
    children,
  }: React.ComponentProps<
    typeof import('#features/pantry/components/analytics/ChartSection').ChartSection
  >) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="chart-section">
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));
jest.mock('#features/pantry/components/charts/TrendLineChart', () => ({
  TrendLineChart: () => null,
}));
jest.mock('#features/pantry/components/charts/BreakdownPieChart', () => ({
  BreakdownPieChart: () => null,
}));
jest.mock('#features/pantry/components/charts/TopItemsBarChart', () => ({
  TopItemsBarChart: () => null,
}));
jest.mock('#features/pantry/components/TabView/TabView', () => ({
  TabView: ({
    routes,
    renderScene,
  }: {
    routes: import('#features/pantry/components/TabView/TabView').TabRoute[];
    renderScene: (props: {
      route: import('#features/pantry/components/TabView/TabView').TabRoute;
    }) => React.ReactNode;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="tab-view">
        {routes.map(route => (
          <View key={route.key}>
            <Text>{route.title}</Text>
            {renderScene({ route })}
          </View>
        ))}
      </View>
    );
  },
}));
jest.mock('#/styles/commonStyles', () => ({
  commonStyles: { container: {} },
}));

describe('PantryAnalytics', () => {
  const route = { params: { pantryId: 'p1' } };

  beforeEach(() => jest.clearAllMocks());

  it('renders the title', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Pantry Analytics')).toBeTruthy();
  });

  it('renders usage tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Usage')).toBeTruthy();
  });

  it('renders waste tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Waste')).toBeTruthy();
  });

  it('renders ledger tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Ledger')).toBeTruthy();
  });

  it('shows usage summary cards', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Total Usage')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('shows waste summary cards', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Total Waste')).toBeTruthy();
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
  });

  it('shows date range filter', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByTestId('date-range-filter')).toBeTruthy();
  });

  it('shows ledger summary cards', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getAllByText('Added').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('shows granularity selector in ledger tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Period:')).toBeTruthy();
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('shows waste rate in waste tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Waste Rate')).toBeTruthy();
    expect(screen.getByText('10.5%')).toBeTruthy();
  });

  it('shows the value lost in each currency apart, never added together', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Est. Value Lost')).toBeTruthy();
    expect(screen.getByText('$12.50 · €3.10')).toBeTruthy();
  });

  it('shows composted value in waste tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Composted')).toBeTruthy();
  });

  it('shows recycled value in waste tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Recycled')).toBeTruthy();
    expect(screen.getByText('1.5')).toBeTruthy();
  });

  it('shows average usage per day', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Avg Per Day')).toBeTruthy();
    expect(screen.getByText('2.5')).toBeTruthy();
  });

  it('shows net change in ledger', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Net Change')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('shows transaction counts', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Additions')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('Consumptions')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  describe('cost figures', () => {
    type CostAnalytics = NonNullable<
      NonNullable<
        ReturnType<typeof usePantryAnalytics>['ledgerData']
      >['costAnalytics']
    >;
    type Spent = CostAnalytics['totalSpent'][number];
    type UnitCost = CostAnalytics['averageCostPerUnit'][number];

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
    });

    /** Renders the screen over a ledger whose cost block is the one given. */
    const renderWithCosts = (
      costs: Pick<CostAnalytics, 'totalSpent' | 'averageCostPerUnit'> | null,
    ) => {
      const costAnalytics: CostAnalytics | null = costs && {
        __typename: 'AdditionCostAnalytics',
        costByStore: [],
        ...costs,
      };
      jest
        .spyOn(
          require('#features/pantry/hooks/usePantryAnalytics'),
          'usePantryAnalytics',
        )
        .mockReturnValue({
          usageData: {
            totalUsageCount: 10,
            averageUsagePerDay: 1,
            usageTrend: [],
            usageByPurpose: [],
            usageBySource: [],
            topUsedItems: [],
          },
          wasteData: {
            totalWasteCount: 0,
            wasteRate: 0,
            valueByCurrency: [],
            composted: 0,
            recycled: 0,
            wasteTrend: [],
            wasteByReason: [],
            topWastedItems: [],
          },
          ledgerData: {
            summary: {
              totalAdded: 10,
              totalConsumed: 5,
              totalWasted: 1,
              netQuantity: 4,
              additionCount: 5,
              consumptionCount: 3,
              additionsByUnit: [],
              consumptionByUnit: [],
            },
            periodData: [],
            costAnalytics,
            topRestockedItems: [],
          },
          usageLoading: false,
          wasteLoading: false,
          ledgerLoading: false,
          usageError: null,
          wasteError: null,
          ledgerError: null,
          dateRange: '7d',
          setDateRange: jest.fn(),
          ledgerGranularity: 'WEEKLY',
          setLedgerGranularity: jest.fn(),
          refetch: jest.fn(() => Promise.resolve()),
        });
      render(<PantryAnalytics route={route} />);
    };

    /** The texts one summary card shows, title first; undefined when absent. */
    const cardTexts = (title: string): string[] | undefined => {
      const card = screen
        .queryAllByTestId('summary-card')
        .find(candidate => within(candidate).queryByText(title));
      return card
        ? within(card)
            .getAllByText(/[^]*/)
            .map(node => String(node.props.children))
        : undefined;
    };
    const sectionTitled = (title: string) =>
      screen
        .queryAllByTestId('chart-section')
        .find(candidate => within(candidate).queryByText(title));

    const totalSpent = t('labels.totalSpent');
    const avgCostPerUnit = t('labels.avgCostPerUnit');
    const perUnit = (unit: string) => t('pantryAnalytics.perUnit', { unit });

    it('shows what was spent in one currency as that amount', () => {
      renderWithCosts({
        totalSpent: [spent(45.99, 'USD')],
        averageCostPerUnit: [],
      });

      expect(cardTexts(totalSpent)).toEqual([totalSpent, '$45.99']);
    });

    it('shows what was spent in two currencies as two amounts, never one total', () => {
      renderWithCosts({
        totalSpent: [spent(45.99, 'USD'), spent(12, 'EUR')],
        averageCostPerUnit: [],
      });

      expect(cardTexts(totalSpent)).toEqual([totalSpent, '$45.99 · €12.00']);
      expect(screen.queryByText(/57\.99/)).toBeNull();
    });

    it('shows an unknown spend, never zero, when nothing in the period was costed', () => {
      renderWithCosts({ totalSpent: [], averageCostPerUnit: [] });

      // The card's whole content: the em dash stands where an amount would.
      expect(cardTexts(totalSpent)).toEqual([totalSpent, UNKNOWN_AMOUNT]);
      // No average to show either: neither the card nor the breakdown.
      expect(screen.queryByText(avgCostPerUnit)).toBeNull();
    });

    // The waste fixture carries no value: no wasted batch had a cost.
    it('shows an unknown value lost, never zero, when no wasted stock was costed', () => {
      renderWithCosts(null);

      const valueLost = t('pantryAnalytics.estValueLost');
      expect(cardTexts(valueLost)).toEqual([valueLost, UNKNOWN_AMOUNT]);
    });

    it('shows the one average on a card that names its unit', () => {
      renderWithCosts({
        totalSpent: [spent(45.99, 'USD')],
        averageCostPerUnit: [unitCost(4.6, 'USD', 'kg')],
      });

      expect(cardTexts(avgCostPerUnit)).toEqual([
        avgCostPerUnit,
        '$4.60',
        perUnit('kg'),
      ]);
      expect(sectionTitled(avgCostPerUnit)).toBeUndefined();
    });

    it('shows the one average without a unit caption when it has no unit', () => {
      renderWithCosts({
        totalSpent: [spent(45.99, 'USD')],
        averageCostPerUnit: [unitCost(4.6, 'USD', null)],
      });

      expect(cardTexts(avgCostPerUnit)).toEqual([avgCostPerUnit, '$4.60']);
    });

    it('lists several averages apart, each amount with its unit, instead of one card', () => {
      renderWithCosts({
        totalSpent: [spent(45.99, 'USD'), spent(12, 'EUR')],
        averageCostPerUnit: [
          unitCost(4.6, 'USD', 'kg'),
          unitCost(0.5, 'USD', 'pc'),
          unitCost(3, 'EUR', 'kg'),
          unitCost(7.25, 'EUR', null),
        ],
      });

      // A kilogram and a piece do not average: no single figure on a card.
      expect(cardTexts(avgCostPerUnit)).toBeUndefined();
      const section = sectionTitled(avgCostPerUnit);
      expect(section).toBeDefined();
      expect(
        within(section!)
          .getAllByText(/[^]*/)
          .map(node => String(node.props.children)),
      ).toEqual([
        avgCostPerUnit,
        '$4.60',
        perUnit('kg'),
        '$0.50',
        perUnit('pc'),
        '€3.00',
        perUnit('kg'),
        '€7.25',
      ]);
    });

    it('shows no cost cards when the ledger carries no cost analytics', () => {
      renderWithCosts(null);

      expect(screen.queryByText(totalSpent)).toBeNull();
      expect(screen.queryByText(avgCostPerUnit)).toBeNull();
    });
  });

  it('renders with period data in ledger', () => {
    jest
      .spyOn(
        require('#features/pantry/hooks/usePantryAnalytics'),
        'usePantryAnalytics',
      )
      .mockReturnValue({
        usageData: {
          totalUsageCount: 0,
          averageUsagePerDay: 0,
          usageTrend: [],
          usageByPurpose: [],
          usageBySource: [],
          topUsedItems: [],
        },
        wasteData: {
          totalWasteCount: 0,
          wasteRate: 0,
          valueByCurrency: [],
          composted: 0,
          recycled: 0,
          wasteTrend: [],
          wasteByReason: [],
          topWastedItems: [],
        },
        ledgerData: {
          summary: {
            totalAdded: 10,
            totalConsumed: 5,
            totalWasted: 1,
            netQuantity: 4,
            additionCount: 5,
            consumptionCount: 3,
            additionsByUnit: [],
            consumptionByUnit: [],
          },
          periodData: [
            {
              periodLabel: '2024-01-01',
              periodStart: '2024-01-01',
              added: 5,
              consumed: 3,
              wasted: 1,
              net: 1,
            },
            {
              periodLabel: '2024-01-08',
              periodStart: '2024-01-02',
              added: 3,
              consumed: 2,
              wasted: 0,
              net: 1,
            },
          ],
          costAnalytics: null,
          topRestockedItems: [],
        },
        usageLoading: false,
        wasteLoading: false,
        ledgerLoading: false,
        usageError: null,
        wasteError: null,
        ledgerError: null,
        dateRange: '7d',
        setDateRange: jest.fn(),
        ledgerGranularity: 'WEEKLY',
        setLedgerGranularity: jest.fn(),
        refetch: jest.fn(() => Promise.resolve()),
      });

    render(<PantryAnalytics route={route} />);
    // `periodLabel` is the API's bucket key, formatted as a local date.
    expect(screen.getByText('Jan 1')).toBeTruthy();
    expect(screen.getByText('Jan 8')).toBeTruthy();
    expect(screen.queryByText('2024-01-01')).toBeNull();
  });

  it('renders with additionsByUnit data', () => {
    jest
      .spyOn(
        require('#features/pantry/hooks/usePantryAnalytics'),
        'usePantryAnalytics',
      )
      .mockReturnValue({
        usageData: {
          totalUsageCount: 0,
          averageUsagePerDay: 0,
          usageTrend: [],
          usageByPurpose: [],
          usageBySource: [],
          topUsedItems: [],
        },
        wasteData: {
          totalWasteCount: 0,
          wasteRate: 0,
          valueByCurrency: [],
          composted: 0,
          recycled: 0,
          wasteTrend: [],
          wasteByReason: [],
          topWastedItems: [],
        },
        ledgerData: {
          summary: {
            totalAdded: 10,
            totalConsumed: 5,
            totalWasted: 1,
            netQuantity: 4,
            additionCount: 5,
            consumptionCount: 3,
            additionsByUnit: [
              {
                unitId: 'u1',
                unitSymbol: 'lbs',
                unitName: 'Pounds',
                totalQuantity: 10,
                count: 3,
              },
            ],
            consumptionByUnit: [
              {
                unitId: 'u1',
                unitSymbol: 'lbs',
                unitName: 'Pounds',
                totalQuantity: 5,
                count: 2,
              },
            ],
          },
          periodData: [],
          costAnalytics: null,
          topRestockedItems: [],
        },
        usageLoading: false,
        wasteLoading: false,
        ledgerLoading: false,
        usageError: null,
        wasteError: null,
        ledgerError: null,
        dateRange: '7d',
        setDateRange: jest.fn(),
        ledgerGranularity: 'WEEKLY',
        setLedgerGranularity: jest.fn(),
        refetch: jest.fn(() => Promise.resolve()),
      });

    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Additions by Unit')).toBeTruthy();
    expect(screen.getByText('10 lbs')).toBeTruthy();
    expect(screen.getByText('(3 transactions)')).toBeTruthy();
    expect(screen.getByText('Consumption by Unit')).toBeTruthy();
    expect(screen.getByText('5 lbs')).toBeTruthy();
  });

  it('renders with negative net quantity', () => {
    jest
      .spyOn(
        require('#features/pantry/hooks/usePantryAnalytics'),
        'usePantryAnalytics',
      )
      .mockReturnValue({
        usageData: {
          totalUsageCount: 0,
          averageUsagePerDay: 0,
          usageTrend: [],
          usageByPurpose: [],
          usageBySource: [],
          topUsedItems: [],
        },
        wasteData: {
          totalWasteCount: 0,
          wasteRate: 0,
          valueByCurrency: [],
          composted: 0,
          recycled: 0,
          wasteTrend: [],
          wasteByReason: [],
          topWastedItems: [],
        },
        ledgerData: {
          summary: {
            totalAdded: 5,
            totalConsumed: 10,
            totalWasted: 3,
            netQuantity: -8,
            additionCount: 2,
            consumptionCount: 5,
            additionsByUnit: [],
            consumptionByUnit: [],
          },
          periodData: [],
          costAnalytics: null,
          topRestockedItems: [],
        },
        usageLoading: false,
        wasteLoading: false,
        ledgerLoading: false,
        usageError: null,
        wasteError: null,
        ledgerError: null,
        dateRange: '7d',
        setDateRange: jest.fn(),
        ledgerGranularity: 'WEEKLY',
        setLedgerGranularity: jest.fn(),
        refetch: jest.fn(() => Promise.resolve()),
      });

    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('-8')).toBeTruthy();
  });

  it('renders ledger quantities through the quantity formatter', () => {
    jest
      .spyOn(
        require('#features/pantry/hooks/usePantryAnalytics'),
        'usePantryAnalytics',
      )
      .mockReturnValue({
        usageData: {
          totalUsageCount: 0,
          averageUsagePerDay: 0,
          usageTrend: [],
          usageByPurpose: [],
          usageBySource: [],
          topUsedItems: [],
        },
        wasteData: {
          totalWasteCount: 0,
          wasteRate: 0,
          valueByCurrency: [],
          composted: 0,
          recycled: 0,
          wasteTrend: [],
          wasteByReason: [],
          topWastedItems: [],
        },
        ledgerData: {
          summary: {
            totalAdded: 1.25,
            totalConsumed: 3.14159,
            totalWasted: 0.33333334,
            netQuantity: -177.4412,
            additionCount: 2,
            consumptionCount: 5,
            additionsByUnit: [
              {
                unitId: 'u1',
                unitSymbol: 'g',
                unitName: 'Grams',
                totalQuantity: 1500,
                count: 3,
              },
            ],
            consumptionByUnit: [
              {
                unitId: 'u2',
                unitSymbol: 'cup',
                unitName: 'Cups',
                totalQuantity: 0.75,
                count: 2,
              },
            ],
          },
          periodData: [
            {
              periodLabel: '2024-01-01',
              periodStart: '2024-01-01',
              added: 0.5,
              consumed: 1.6667,
              wasted: 2.456,
              net: 0,
            },
          ],
          costAnalytics: null,
          topRestockedItems: [],
        },
        usageLoading: false,
        wasteLoading: false,
        ledgerLoading: false,
        usageError: null,
        wasteError: null,
        ledgerError: null,
        dateRange: '7d',
        setDateRange: jest.fn(),
        ledgerGranularity: 'WEEKLY',
        setLedgerGranularity: jest.fn(),
        refetch: jest.fn(() => Promise.resolve()),
      });

    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('1 1/4')).toBeTruthy();
    expect(screen.getByText('3.142')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('-177.441')).toBeTruthy();
    expect(screen.getByText('+1/2')).toBeTruthy();
    expect(screen.getByText('-1 2/3')).toBeTruthy();
    expect(screen.getByText('-2.456')).toBeTruthy();
    expect(screen.getByText('1.5 kg')).toBeTruthy();
    expect(screen.getByText('3/4 cup')).toBeTruthy();
  });
});

'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PantryAnalytics } from '../PantryAnalytics';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/pantry/usePantryAnalytics', () => ({
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
      totalWasteValue: 12.50,
      composted: 2.0,
      wasteTrend: [],
      wasteByReason: [{ reason: 'EXPIRED', count: 3, percentage: 60 }],
      topWastedItems: [{ itemName: 'Lettuce', count: 2, estimatedValue: 4.00 }],
    },
    ledgerData: {
      summary: {
        totalAdded: 100,
        totalConsumed: 80,
        totalWasted: 5,
        netQuantity: 15,
        additionCount: 50,
        consumptionCount: 40,
        additionsByUnit: null,
        consumptionByUnit: null,
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

jest.mock('#generated', () => ({
  PeriodGranularity: { Daily: 'DAILY', Weekly: 'WEEKLY', Monthly: 'MONTHLY' },
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="header"><Text>{title}</Text></View>;
  },
}));
jest.mock('#components/analytics/DateRangeFilter', () => ({
  DateRangeFilter: () => {
    const { View } = require('react-native');
    return <View testID="date-range-filter" />;
  },
}));
jest.mock('#components/analytics/AnalyticsSummaryCard', () => ({
  AnalyticsSummaryCard: ({ title, value, subtitle }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="summary-card"><Text>{title}</Text><Text>{String(value)}</Text>{subtitle ? <Text>{subtitle}</Text> : null}</View>;
  },
}));
jest.mock('#components/analytics/ChartSection', () => ({
  ChartSection: ({ title, children }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="chart-section"><Text>{title}</Text>{children}</View>;
  },
}));
jest.mock('#components/charts/TrendLineChart', () => ({ TrendLineChart: () => null }));
jest.mock('#components/charts/BreakdownPieChart', () => ({ BreakdownPieChart: () => null }));
jest.mock('#components/charts/TopItemsBarChart', () => ({ TopItemsBarChart: () => null }));
jest.mock('#components/molecules/TabView/TabView', () => ({
  TabView: ({ routes, renderScene }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="tab-view">
        {routes.map((route: any) => (
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

  it('shows estimated value lost in waste tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Est. Value Lost')).toBeTruthy();
    expect(screen.getByText('$12.50')).toBeTruthy();
  });

  it('shows composted value in waste tab', () => {
    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Composted')).toBeTruthy();
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

  it('renders with cost analytics data', () => {
    jest.spyOn(require('#hooks/pantry/usePantryAnalytics'), 'usePantryAnalytics').mockReturnValue({
      usageData: { totalUsageCount: 10, averageUsagePerDay: 1, usageTrend: [], usageByPurpose: [], usageBySource: [], topUsedItems: [] },
      wasteData: { totalWasteCount: 0, wasteRate: 0, totalWasteValue: 0, composted: 0, wasteTrend: [], wasteByReason: [], topWastedItems: [] },
      ledgerData: {
        summary: { totalAdded: 10, totalConsumed: 5, totalWasted: 1, netQuantity: 4, additionCount: 5, consumptionCount: 3, additionsByUnit: null, consumptionByUnit: null },
        periodData: [],
        costAnalytics: { totalSpent: 45.99, averageCostPerUnit: 4.60 },
        topRestockedItems: [],
      },
      usageLoading: false, wasteLoading: false, ledgerLoading: false,
      usageError: null, wasteError: null, ledgerError: null,
      dateRange: '7d', setDateRange: jest.fn(),
      ledgerGranularity: 'WEEKLY', setLedgerGranularity: jest.fn(),
      refetch: jest.fn(() => Promise.resolve()),
    });

    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Total Spent')).toBeTruthy();
    expect(screen.getByText('$45.99')).toBeTruthy();
    expect(screen.getByText('Avg Cost/Unit')).toBeTruthy();
    expect(screen.getByText('$4.60')).toBeTruthy();
  });

  it('renders with period data in ledger', () => {
    jest.spyOn(require('#hooks/pantry/usePantryAnalytics'), 'usePantryAnalytics').mockReturnValue({
      usageData: { totalUsageCount: 0, averageUsagePerDay: 0, usageTrend: [], usageByPurpose: [], usageBySource: [], topUsedItems: [] },
      wasteData: { totalWasteCount: 0, wasteRate: 0, totalWasteValue: 0, composted: 0, wasteTrend: [], wasteByReason: [], topWastedItems: [] },
      ledgerData: {
        summary: { totalAdded: 10, totalConsumed: 5, totalWasted: 1, netQuantity: 4, additionCount: 5, consumptionCount: 3, additionsByUnit: null, consumptionByUnit: null },
        periodData: [
          { periodLabel: 'Mon', periodStart: '2024-01-01', added: 5, consumed: 3, wasted: 1, net: 1 },
          { periodLabel: 'Tue', periodStart: '2024-01-02', added: 3, consumed: 2, wasted: 0, net: 1 },
        ],
        costAnalytics: null,
        topRestockedItems: [],
      },
      usageLoading: false, wasteLoading: false, ledgerLoading: false,
      usageError: null, wasteError: null, ledgerError: null,
      dateRange: '7d', setDateRange: jest.fn(),
      ledgerGranularity: 'WEEKLY', setLedgerGranularity: jest.fn(),
      refetch: jest.fn(() => Promise.resolve()),
    });

    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('Tue')).toBeTruthy();
  });

  it('renders with additionsByUnit data', () => {
    jest.spyOn(require('#hooks/pantry/usePantryAnalytics'), 'usePantryAnalytics').mockReturnValue({
      usageData: { totalUsageCount: 0, averageUsagePerDay: 0, usageTrend: [], usageByPurpose: [], usageBySource: [], topUsedItems: [] },
      wasteData: { totalWasteCount: 0, wasteRate: 0, totalWasteValue: 0, composted: 0, wasteTrend: [], wasteByReason: [], topWastedItems: [] },
      ledgerData: {
        summary: {
          totalAdded: 10, totalConsumed: 5, totalWasted: 1, netQuantity: 4,
          additionCount: 5, consumptionCount: 3,
          additionsByUnit: [{ unitId: 'u1', unitSymbol: 'lbs', unitName: 'Pounds', totalQuantity: 10, count: 3 }],
          consumptionByUnit: [{ unitId: 'u1', unitSymbol: 'lbs', unitName: 'Pounds', totalQuantity: 5, count: 2 }],
        },
        periodData: [],
        costAnalytics: null,
        topRestockedItems: [],
      },
      usageLoading: false, wasteLoading: false, ledgerLoading: false,
      usageError: null, wasteError: null, ledgerError: null,
      dateRange: '7d', setDateRange: jest.fn(),
      ledgerGranularity: 'WEEKLY', setLedgerGranularity: jest.fn(),
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
    jest.spyOn(require('#hooks/pantry/usePantryAnalytics'), 'usePantryAnalytics').mockReturnValue({
      usageData: { totalUsageCount: 0, averageUsagePerDay: 0, usageTrend: [], usageByPurpose: [], usageBySource: [], topUsedItems: [] },
      wasteData: { totalWasteCount: 0, wasteRate: 0, totalWasteValue: 0, composted: 0, wasteTrend: [], wasteByReason: [], topWastedItems: [] },
      ledgerData: {
        summary: { totalAdded: 5, totalConsumed: 10, totalWasted: 3, netQuantity: -8, additionCount: 2, consumptionCount: 5, additionsByUnit: null, consumptionByUnit: null },
        periodData: [],
        costAnalytics: null,
        topRestockedItems: [],
      },
      usageLoading: false, wasteLoading: false, ledgerLoading: false,
      usageError: null, wasteError: null, ledgerError: null,
      dateRange: '7d', setDateRange: jest.fn(),
      ledgerGranularity: 'WEEKLY', setLedgerGranularity: jest.fn(),
      refetch: jest.fn(() => Promise.resolve()),
    });

    render(<PantryAnalytics route={route} />);
    expect(screen.getByText('-8')).toBeTruthy();
  });
});

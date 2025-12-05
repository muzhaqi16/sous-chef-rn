import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import {
  useGetPantryLedgerAnalyticsQuery,
  PeriodGranularity,
  DateRange,
  type AnalyticsFilterInput,
} from '#generated';
import type { UsageAnalytics, WasteAnalytics } from '#types';

// GraphQL queries - these will work once the backend schema is available
const GET_PANTRY_USAGE_ANALYTICS = gql`
  query GetPantryUsageAnalytics($pantryId: ID!, $filter: AnalyticsFilterInput) {
    pantryUsageAnalytics(pantryId: $pantryId, filter: $filter) {
      totalUsageCount
      totalQuantityUsed
      averageUsagePerDay
      periodStart
      periodEnd
      usageTrend {
        date
        value
      }
      usageByPurpose {
        purpose
        count
        percentage
      }
      usageBySource {
        source
        count
        percentage
      }
      topUsedItems {
        itemId
        itemName
        imageUrl
        count
        totalQuantity
        unitName
      }
    }
  }
`;

const GET_PANTRY_WASTE_ANALYTICS = gql`
  query GetPantryWasteAnalytics($pantryId: ID!, $filter: AnalyticsFilterInput) {
    pantryWasteAnalytics(pantryId: $pantryId, filter: $filter) {
      totalWasteCount
      totalWasteQuantity
      totalWasteValue
      wasteRate
      averageWastePerDay
      composted
      recycled
      periodStart
      periodEnd
      wasteTrend {
        date
        value
      }
      wasteByReason {
        reason
        count
        percentage
        estimatedValue
      }
      topWastedItems {
        itemId
        itemName
        imageUrl
        count
        totalQuantity
        estimatedValue
        unitName
      }
    }
  }
`;

interface UsePantryAnalyticsOptions {
  pantryId: string | undefined;
  initialDateRange?: DateRange;
  ledgerGranularity?: PeriodGranularity;
}

// Ledger summary type based on API
interface LedgerSummary {
  totalAdded: number;
  totalConsumed: number;
  totalWasted: number;
  netQuantity: number;
  additionCount: number;
  consumptionCount: number;
  wasteCount: number;
  additionsByUnit: Array<{
    unitId: string;
    unitName: string;
    unitSymbol: string;
    totalQuantity: number;
    count: number;
  }>;
  consumptionByUnit: Array<{
    unitId: string;
    unitName: string;
    unitSymbol: string;
    totalQuantity: number;
    count: number;
  }>;
}

interface LedgerPeriodData {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  added: number;
  consumed: number;
  wasted: number;
  net: number;
  additionCost: number | null;
}

interface CostAnalytics {
  totalSpent: number;
  averageCostPerUnit: number;
  costByStore: Array<{
    storeId: string;
    storeName: string;
    totalSpent: number;
    itemCount: number;
  }>;
}

interface LedgerAnalytics {
  summary: LedgerSummary;
  periodData: LedgerPeriodData[];
  costAnalytics: CostAnalytics | null;
  topRestockedItems: Array<{
    itemId: string;
    itemName: string;
    totalQuantity: number;
  }>;
  granularity: PeriodGranularity;
}

interface UsePantryAnalyticsReturn {
  // Usage data
  usageData: UsageAnalytics | null;
  usageLoading: boolean;
  usageError: Error | undefined;

  // Waste data
  wasteData: WasteAnalytics | null;
  wasteLoading: boolean;
  wasteError: Error | undefined;

  // Ledger data
  ledgerData: LedgerAnalytics | null;
  ledgerLoading: boolean;
  ledgerError: Error | undefined;

  // Combined loading state
  loading: boolean;

  // Filter state
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;

  // Ledger granularity
  ledgerGranularity: PeriodGranularity;
  setLedgerGranularity: (granularity: PeriodGranularity) => void;

  // Actions
  refetch: () => Promise<void>;
}

export function usePantryAnalytics({
  pantryId,
  initialDateRange = DateRange.LastMonth,
  ledgerGranularity: initialLedgerGranularity = PeriodGranularity.Weekly,
}: UsePantryAnalyticsOptions): UsePantryAnalyticsReturn {
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  const [ledgerGranularity, setLedgerGranularity] = useState<PeriodGranularity>(
    initialLedgerGranularity,
  );

  const hasValidPantryId = !!pantryId?.trim();

  const filter: AnalyticsFilterInput = {
    dateRange,
    topItemsLimit: 10,
  };

  const {
    data: usageQueryData,
    loading: usageLoading,
    error: usageError,
    refetch: refetchUsage,
  } = useQuery<{ pantryUsageAnalytics: UsageAnalytics }>(
    GET_PANTRY_USAGE_ANALYTICS,
    {
      variables: { pantryId, filter },
      skip: !hasValidPantryId,
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
  );

  const {
    data: wasteQueryData,
    loading: wasteLoading,
    error: wasteError,
    refetch: refetchWaste,
  } = useQuery<{ pantryWasteAnalytics: WasteAnalytics }>(
    GET_PANTRY_WASTE_ANALYTICS,
    {
      variables: { pantryId, filter },
      skip: !hasValidPantryId,
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
  );

  const {
    data: ledgerQueryData,
    loading: ledgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useGetPantryLedgerAnalyticsQuery({
    variables: {
      pantryId: pantryId ?? '',
      filter,
      granularity: ledgerGranularity,
    },
    skip: !hasValidPantryId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const refetch = useCallback(async () => {
    await Promise.all([refetchUsage(), refetchWaste(), refetchLedger()]);
  }, [refetchUsage, refetchWaste, refetchLedger]);

  return {
    usageData: usageQueryData?.pantryUsageAnalytics ?? null,
    usageLoading,
    usageError: usageError as Error | undefined,
    wasteData: wasteQueryData?.pantryWasteAnalytics ?? null,
    wasteLoading,
    wasteError: wasteError as Error | undefined,
    ledgerData: (ledgerQueryData?.pantryLedgerAnalytics as LedgerAnalytics) ?? null,
    ledgerLoading,
    ledgerError: ledgerError as Error | undefined,
    loading: usageLoading || wasteLoading || ledgerLoading,
    dateRange,
    setDateRange,
    ledgerGranularity,
    setLedgerGranularity,
    refetch,
  };
}

import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type {
  DateRange,
  AnalyticsFilterInput,
  UsageAnalytics,
  WasteAnalytics,
} from '#types';

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
      }
    }
  }
`;

interface UsePantryAnalyticsOptions {
  pantryId: string | undefined;
  initialDateRange?: DateRange;
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

  // Combined loading state
  loading: boolean;

  // Filter state
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;

  // Actions
  refetch: () => Promise<void>;
}

export function usePantryAnalytics({
  pantryId,
  initialDateRange = 'LAST_MONTH',
}: UsePantryAnalyticsOptions): UsePantryAnalyticsReturn {
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);

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

  const refetch = useCallback(async () => {
    await Promise.all([refetchUsage(), refetchWaste()]);
  }, [refetchUsage, refetchWaste]);

  return {
    usageData: usageQueryData?.pantryUsageAnalytics ?? null,
    usageLoading,
    usageError: usageError as Error | undefined,
    wasteData: wasteQueryData?.pantryWasteAnalytics ?? null,
    wasteLoading,
    wasteError: wasteError as Error | undefined,
    loading: usageLoading || wasteLoading,
    dateRange,
    setDateRange,
    refetch,
  };
}

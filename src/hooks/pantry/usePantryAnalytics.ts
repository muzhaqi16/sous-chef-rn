import { useState, useCallback } from 'react';
import {
  useGetPantryUsageAnalyticsQuery,
  useGetPantryWasteAnalyticsQuery,
  useGetPantryLedgerAnalyticsQuery,
  PeriodGranularity,
  DateRange,
  type AnalyticsFilters,
  type GetPantryUsageAnalyticsQuery,
  type GetPantryWasteAnalyticsQuery,
  type GetPantryLedgerAnalyticsQuery,
} from '#generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

type UsageAnalytics = NonNullable<GetPantryUsageAnalyticsQuery['pantry']>['usageAnalytics'];
type WasteAnalytics = NonNullable<GetPantryWasteAnalyticsQuery['pantry']>['wasteAnalytics'];
type LedgerAnalytics = NonNullable<GetPantryLedgerAnalyticsQuery['pantry']>['ledgerAnalytics'];

interface UsePantryAnalyticsOptions {
  pantryId: string | undefined;
  initialDateRange?: DateRange;
  ledgerGranularity?: PeriodGranularity;
}

interface UsePantryAnalyticsReturn {
  usageData: UsageAnalytics | null;
  usageLoading: boolean;
  usageError: Error | undefined;
  wasteData: WasteAnalytics | null;
  wasteLoading: boolean;
  wasteError: Error | undefined;
  ledgerData: LedgerAnalytics | null;
  ledgerLoading: boolean;
  ledgerError: Error | undefined;
  loading: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  ledgerGranularity: PeriodGranularity;
  setLedgerGranularity: (granularity: PeriodGranularity) => void;
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

  const filter: AnalyticsFilters = {
    dateRange,
    topItemsLimit: 10,
  };

  const {
    data: usageQueryData,
    loading: usageLoading,
    error: usageError,
    refetch: refetchUsage,
  } = useGetPantryUsageAnalyticsQuery({
    variables: { pantryId: pantryId ?? '', filter },
    skip: !hasValidPantryId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const {
    data: wasteQueryData,
    loading: wasteLoading,
    error: wasteError,
    refetch: refetchWaste,
  } = useGetPantryWasteAnalyticsQuery({
    variables: { pantryId: pantryId ?? '', filter },
    skip: !hasValidPantryId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

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

  useApolloErrorLogger('GetPantryUsageAnalytics', usageError);
  useApolloErrorLogger('GetPantryWasteAnalytics', wasteError);
  useApolloErrorLogger('GetPantryLedgerAnalytics', ledgerError);

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchUsage(),
      refetchWaste(),
      refetchLedger(),
    ]);
  }, [refetchUsage, refetchWaste, refetchLedger]);

  return {
    usageData: usageQueryData?.pantry?.usageAnalytics ?? null,
    usageLoading,
    usageError: usageError as Error | undefined,
    wasteData: wasteQueryData?.pantry?.wasteAnalytics ?? null,
    wasteLoading,
    wasteError: wasteError as Error | undefined,
    ledgerData: ledgerQueryData?.pantry?.ledgerAnalytics ?? null,
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

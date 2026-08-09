import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GetPantryUsageAnalyticsDocument,
  GetPantryWasteAnalyticsDocument,
  GetPantryLedgerAnalyticsDocument,
  type GetPantryUsageAnalyticsQuery,
  type GetPantryWasteAnalyticsQuery,
  type GetPantryLedgerAnalyticsQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  PeriodGranularity,
  DateRange,
  type AnalyticsFilters,
} from '#/graphql/generated/schemaTypes';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';

type UsageAnalytics = NonNullable<
  GetPantryUsageAnalyticsQuery['pantry']
>['usageAnalytics'];
type WasteAnalytics = NonNullable<
  GetPantryWasteAnalyticsQuery['pantry']
>['wasteAnalytics'];
type LedgerAnalytics = NonNullable<
  GetPantryLedgerAnalyticsQuery['pantry']
>['ledgerAnalytics'];

interface UsePantryAnalyticsOptions {
  pantryId: string | undefined;
  initialDateRange?: DateRange;
  ledgerGranularity?: PeriodGranularity;
}

interface UsePantryAnalyticsReturn {
  usageData: UsageAnalytics | null;
  usageLoading: boolean;
  usageError: Error | undefined;
  /** No network was attempted and nothing was cached for these filters. */
  usageOffline: boolean;
  wasteData: WasteAnalytics | null;
  wasteLoading: boolean;
  wasteError: Error | undefined;
  wasteOffline: boolean;
  ledgerData: LedgerAnalytics | null;
  ledgerLoading: boolean;
  ledgerError: Error | undefined;
  ledgerOffline: boolean;
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
  } = useQuery(GetPantryUsageAnalyticsDocument, {
    variables: { pantryId: pantryId ?? '', filter },
    skip: !hasValidPantryId,
  });

  const {
    data: wasteQueryData,
    loading: wasteLoading,
    error: wasteError,
    refetch: refetchWaste,
  } = useQuery(GetPantryWasteAnalyticsDocument, {
    variables: { pantryId: pantryId ?? '', filter },
    skip: !hasValidPantryId,
  });

  const {
    data: ledgerQueryData,
    loading: ledgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useQuery(GetPantryLedgerAnalyticsDocument, {
    variables: {
      pantryId: pantryId ?? '',
      filter,
      granularity: ledgerGranularity,
    },
    skip: !hasValidPantryId,
  });

  useApolloErrorLogger('GetPantryUsageAnalytics', usageError);
  useApolloErrorLogger('GetPantryWasteAnalytics', wasteError);
  useApolloErrorLogger('GetPantryLedgerAnalytics', ledgerError);

  /**
   * `allSettled`, not `all`, so a refresh always resolves: callers clear their
   * spinner in the caller's own `finally`, and each query reports its own
   * error/offline state.
   *
   * Today `all` would behave the same — `watchQuery.errorPolicy: 'all'`
   * (src/apollo/client.ts) makes a failing refetch resolve with `{data, error}`
   * rather than reject. That is the only reason `all` was safe, which is a lot
   * of load for a default to bear when the offline state now offers a Refresh
   * button that fires exactly when these fail.
   */
  const refetch = async () => {
    await Promise.allSettled([refetchUsage(), refetchWaste(), refetchLedger()]);
  };

  const usageAnalytics = usageQueryData?.pantry?.usageAnalytics ?? null;
  const wasteAnalytics = wasteQueryData?.pantry?.wasteAnalytics ?? null;
  const ledgerAnalytics = ledgerQueryData?.pantry?.ledgerAnalytics ?? null;

  // Filtered by `dateRange` / `granularity`, so each combination is its own
  // cache entry — offline, changing a filter is a guaranteed miss even when the
  // screen was populated a second ago. See `useOfflineAwareError`.
  const usage = useOfflineAwareError(
    usageError as Error | undefined,
    usageAnalytics !== null,
  );
  const waste = useOfflineAwareError(
    wasteError as Error | undefined,
    wasteAnalytics !== null,
  );
  const ledger = useOfflineAwareError(
    ledgerError as Error | undefined,
    ledgerAnalytics !== null,
  );

  return {
    usageData: usageAnalytics,
    usageLoading,
    usageError: usage.error,
    usageOffline: usage.offline,
    wasteData: wasteAnalytics,
    wasteLoading,
    wasteError: waste.error,
    wasteOffline: waste.offline,
    ledgerData: ledgerAnalytics,
    ledgerLoading,
    ledgerError: ledger.error,
    ledgerOffline: ledger.offline,
    loading: usageLoading || wasteLoading || ledgerLoading,
    dateRange,
    setDateRange,
    ledgerGranularity,
    setLedgerGranularity,
    refetch,
  };
}

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
   * `allSettled`, not `all`, so a refresh always resolves whatever the global
   * `errorPolicy` default happens to be; each query reports its own error state.
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

  // `loading && !data`, never bare `loading`: under `cache-and-network` Apollo
  // reports `loading` for the whole network leg on EVERY mount, which would
  // replace already-drawn charts with a spinner on each visit. A filter change
  // still spins — each dateRange/granularity is its own cache entry, so null.
  const usageIsBlank = usageLoading && usageAnalytics === null;
  const wasteIsBlank = wasteLoading && wasteAnalytics === null;
  const ledgerIsBlank = ledgerLoading && ledgerAnalytics === null;

  return {
    usageData: usageAnalytics,
    usageLoading: usageIsBlank,
    usageError: usage.error,
    usageOffline: usage.offline,
    wasteData: wasteAnalytics,
    wasteLoading: wasteIsBlank,
    wasteError: waste.error,
    wasteOffline: waste.offline,
    ledgerData: ledgerAnalytics,
    ledgerLoading: ledgerIsBlank,
    ledgerError: ledger.error,
    ledgerOffline: ledger.offline,
    loading: usageIsBlank || wasteIsBlank || ledgerIsBlank,
    dateRange,
    setDateRange,
    ledgerGranularity,
    setLedgerGranularity,
    refetch,
  };
}

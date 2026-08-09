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
import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';

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
  const networkBlocked = useBlocksCacheMissQueries();
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

  const refetch = async () => {
    await Promise.all([refetchUsage(), refetchWaste(), refetchLedger()]);
  };

  const usageAnalytics = usageQueryData?.pantry?.usageAnalytics ?? null;
  const wasteAnalytics = wasteQueryData?.pantry?.wasteAnalytics ?? null;
  const ledgerAnalytics = ledgerQueryData?.pantry?.ledgerAnalytics ?? null;

  /**
   * Splits `offlineModeLink`'s synthetic "no cached data" error away from a
   * genuine failure. These queries are filtered (`dateRange`, `granularity`),
   * so each combination is its own cache entry — offline, changing a filter is
   * a guaranteed miss even when the screen was fully populated a second ago.
   * Reporting that as an error puts a red alert on a screen where nothing is
   * actually wrong, so it is surfaced as an offline state instead.
   *
   * Only when there is no data: a cached hit alongside a failed background
   * revalidation is still worth showing, and stays a plain (non-blocking)
   * error.
   */
  const classify = (error: unknown, data: unknown) => {
    const unavailableOffline = networkBlocked && !!error && data === null;
    return {
      error: unavailableOffline ? undefined : (error as Error | undefined),
      offline: unavailableOffline,
    };
  };

  const usage = classify(usageError, usageAnalytics);
  const waste = classify(wasteError, wasteAnalytics);
  const ledger = classify(ledgerError, ledgerAnalytics);

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

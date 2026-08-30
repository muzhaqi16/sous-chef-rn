import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import {
  GetPantryUsageAnalyticsDocument,
  GetPantryWasteAnalyticsDocument,
  GetPantryLedgerAnalyticsDocument,
} from '#features/pantry/graphql/pantry.generated';
import { PeriodGranularity, DateRange } from '#/graphql/generated/schemaTypes';
import { createApolloTestWrapper } from '#/test-utils/apolloMockProvider';
import { usePantryAnalytics } from '../usePantryAnalytics';

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#hooks/app/useBlocksCacheMissQueries', () => ({
  useBlocksCacheMissQueries: jest.fn(() => false),
}));

const mockedNetworkBlocked = jest.requireMock(
  '#hooks/app/useBlocksCacheMissQueries',
) as { useBlocksCacheMissQueries: jest.Mock };

const setNetworkBlocked = (blocked: boolean) =>
  mockedNetworkBlocked.useBlocksCacheMissQueries.mockReturnValue(blocked);

beforeEach(() => setNetworkBlocked(false));

const usageData = {
  __typename: 'PantryUsageAnalytics',
  totalUsageCount: 42,
  averageUsagePerDay: 2.5,
  topUsedItems: [],
};

const wasteData = {
  __typename: 'PantryWasteAnalytics',
  totalWasteCount: 5,
  wasteRate: 0.1,
  recycled: 1.0,
};

const ledgerData = {
  __typename: 'PantryLedgerAnalytics',
  periodData: [],
  summary: {
    __typename: 'PantryLedgerSummary',
    totalAdded: 10,
    totalConsumed: 7,
    totalWasted: 3,
  },
};

function defaultMocks(
  pantryId = 'pantry-1',
  granularity: PeriodGranularity = PeriodGranularity.Weekly,
  dateRange: DateRange = DateRange.LastMonth,
): MockedResponse[] {
  const filter = { dateRange, topItemsLimit: 10 };
  return [
    {
      request: {
        query: GetPantryUsageAnalyticsDocument,
        variables: { pantryId, filter },
      },
      result: {
        data: {
          pantry: {
            __typename: 'Pantry',
            id: pantryId,
            usageAnalytics: usageData,
          },
        },
      },
    },
    {
      request: {
        query: GetPantryWasteAnalyticsDocument,
        variables: { pantryId, filter },
      },
      result: {
        data: {
          pantry: {
            __typename: 'Pantry',
            id: pantryId,
            wasteAnalytics: wasteData,
          },
        },
      },
    },
    {
      request: {
        query: GetPantryLedgerAnalyticsDocument,
        variables: { pantryId, filter, granularity },
      },
      result: {
        data: {
          pantry: {
            __typename: 'Pantry',
            id: pantryId,
            ledgerAnalytics: ledgerData,
          },
        },
      },
    },
  ];
}

/**
 * The usage query fails; waste and ledger resolve. Keeping the other two
 * healthy is what makes the per-query classification observable — a blanket
 * flag would wrongly mark all three.
 */
function failingMocks(pantryId = 'pantry-1'): MockedResponse[] {
  const filter = { dateRange: DateRange.LastMonth, topItemsLimit: 10 };
  return [
    {
      request: {
        query: GetPantryUsageAnalyticsDocument,
        variables: { pantryId, filter },
      },
      error: new Error('Query failed'),
    },
    ...defaultMocks(pantryId).filter(
      mock => mock.request.query !== GetPantryUsageAnalyticsDocument,
    ),
  ];
}

describe('usePantryAnalytics', () => {
  it('returns analytics data when pantryId is provided', async () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Fixtures state the fields under test; the rest of each selection set is
    // filled from the SDL, so this checks the hook routes each query to the
    // right output rather than that the fixtures were exhaustive.
    expect(result.current.usageData).toMatchObject(usageData);
    expect(result.current.wasteData).toMatchObject(wasteData);
    expect(result.current.ledgerData).toMatchObject(ledgerData);
  });

  it('returns null data when pantryId is empty (queries skipped)', () => {
    const { result } = renderHook(() => usePantryAnalytics({ pantryId: '' }), {
      wrapper: createApolloTestWrapper({ operationMocks: [] }),
    });

    expect(result.current.usageData).toBeNull();
    expect(result.current.wasteData).toBeNull();
    expect(result.current.ledgerData).toBeNull();
  });

  it('uses LastMonth as default dateRange', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }) },
    );

    expect(result.current.dateRange).toBe(DateRange.LastMonth);
  });

  it('uses Weekly as default ledgerGranularity', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }) },
    );

    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Weekly);
  });

  it('accepts custom initial dateRange and granularity', () => {
    const { result } = renderHook(
      () =>
        usePantryAnalytics({
          pantryId: 'pantry-1',
          initialDateRange: DateRange.LastYear,
          ledgerGranularity: PeriodGranularity.Monthly,
        }),
      {
        wrapper: createApolloTestWrapper({
          operationMocks: defaultMocks(
            'pantry-1',
            PeriodGranularity.Monthly,
            DateRange.LastYear,
          ),
        }),
      },
    );

    expect(result.current.dateRange).toBe(DateRange.LastYear);
    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Monthly);
  });

  it('allows changing dateRange via setDateRange', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }) },
    );

    act(() => {
      result.current.setDateRange(DateRange.LastWeek);
    });

    expect(result.current.dateRange).toBe(DateRange.LastWeek);
  });

  it('allows changing ledgerGranularity via setLedgerGranularity', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }) },
    );

    act(() => {
      result.current.setLedgerGranularity(PeriodGranularity.Daily);
    });

    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Daily);
  });

  describe('loading state', () => {
    it('starts true and resolves to false once mocks settle', async () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }),
        },
      );

      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it('is false when pantryId is invalid (queries skipped)', () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: '' }),
        { wrapper: createApolloTestWrapper({ operationMocks: [] }) },
      );

      expect(result.current.loading).toBe(false);
    });
  });

  describe('error state', () => {
    it('exposes usage query error', async () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: failingMocks() }),
        },
      );

      await waitFor(() => expect(result.current.usageError).toBeDefined());
      expect(result.current.wasteError).toBeUndefined();
      expect(result.current.ledgerError).toBeUndefined();
    });

    it('reports a failure while online as an error, not as offline', async () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: failingMocks() }),
        },
      );

      await waitFor(() => expect(result.current.usageError).toBeDefined());
      expect(result.current.usageOffline).toBe(false);
    });
  });

  /**
   * These queries are filtered, so every date range is its own cache entry.
   * Offline, switching the range is a guaranteed miss and `offlineModeLink`
   * answers with a synthetic error — which must not reach the screen as a red
   * chart error, because nothing has actually failed.
   */
  describe('offline classification', () => {
    it('surfaces a cache miss with no network leg as offline, not an error', async () => {
      setNetworkBlocked(true);

      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: failingMocks() }),
        },
      );

      await waitFor(() => expect(result.current.usageOffline).toBe(true));
      expect(result.current.usageError).toBeUndefined();
      expect(result.current.usageData).toBeNull();
    });

    it('leaves the other queries alone when only one misses', async () => {
      setNetworkBlocked(true);

      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: failingMocks() }),
        },
      );

      await waitFor(() => expect(result.current.usageOffline).toBe(true));
      // Only the usage query is mocked as failing; the other two resolve, so a
      // blanket "we're offline" flag would be wrong for them.
      expect(result.current.wasteOffline).toBe(false);
      expect(result.current.ledgerOffline).toBe(false);
      expect(result.current.wasteData).not.toBeNull();
    });
  });

  describe('refetch', () => {
    it('resolves even when a query fails, so callers can clear their spinner', async () => {
      // A contract test, not a regression test: it passes under `Promise.all`
      // too, because `watchQuery.errorPolicy: 'all'` stops a failing refetch
      // from rejecting in the first place. It pins the guarantee callers rely
      // on — `handleRefresh` must be able to clear `refreshing` — so that
      // changing either the errorPolicy or the combinator fails here rather
      // than stranding a spinner on screen.
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: failingMocks() }),
        },
      );

      await waitFor(() => expect(result.current.usageError).toBeDefined());
      await expect(result.current.refetch()).resolves.toBeUndefined();
    });

    it('exposes a refetch function', async () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        {
          wrapper: createApolloTestWrapper({ operationMocks: defaultMocks() }),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('skip behavior', () => {
    it('skips queries when pantryId is undefined (no mocks consumed)', () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: undefined }),
        { wrapper: createApolloTestWrapper({ operationMocks: [] }) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.usageData).toBeNull();
    });

    it('skips queries when pantryId is whitespace-only', () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: '   ' }),
        { wrapper: createApolloTestWrapper({ operationMocks: [] }) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.usageData).toBeNull();
    });
  });
});

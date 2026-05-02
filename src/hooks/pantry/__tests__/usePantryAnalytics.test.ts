import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import {
  GetPantryUsageAnalyticsDocument,
  GetPantryWasteAnalyticsDocument,
  GetPantryLedgerAnalyticsDocument,
} from '#operations/pantry/pantry.generated';
import { PeriodGranularity, DateRange } from '#/graphql/generated/schemaTypes';
import { createApolloWrapper } from '../../../../__tests__/helpers/apolloMockProvider';
import { usePantryAnalytics } from '../usePantryAnalytics';

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

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

describe('usePantryAnalytics', () => {
  it('returns analytics data when pantryId is provided', async () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloWrapper(defaultMocks()) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.usageData).toEqual(usageData);
    expect(result.current.wasteData).toEqual(wasteData);
    expect(result.current.ledgerData).toEqual(ledgerData);
  });

  it('returns null data when pantryId is empty (queries skipped)', () => {
    const { result } = renderHook(() => usePantryAnalytics({ pantryId: '' }), {
      wrapper: createApolloWrapper([]),
    });

    expect(result.current.usageData).toBeNull();
    expect(result.current.wasteData).toBeNull();
    expect(result.current.ledgerData).toBeNull();
  });

  it('uses LastMonth as default dateRange', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloWrapper(defaultMocks()) },
    );

    expect(result.current.dateRange).toBe(DateRange.LastMonth);
  });

  it('uses Weekly as default ledgerGranularity', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloWrapper(defaultMocks()) },
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
        wrapper: createApolloWrapper(
          defaultMocks(
            'pantry-1',
            PeriodGranularity.Monthly,
            DateRange.LastYear,
          ),
        ),
      },
    );

    expect(result.current.dateRange).toBe(DateRange.LastYear);
    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Monthly);
  });

  it('allows changing dateRange via setDateRange', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloWrapper(defaultMocks()) },
    );

    act(() => {
      result.current.setDateRange(DateRange.LastWeek);
    });

    expect(result.current.dateRange).toBe(DateRange.LastWeek);
  });

  it('allows changing ledgerGranularity via setLedgerGranularity', () => {
    const { result } = renderHook(
      () => usePantryAnalytics({ pantryId: 'pantry-1' }),
      { wrapper: createApolloWrapper(defaultMocks()) },
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
        { wrapper: createApolloWrapper(defaultMocks()) },
      );

      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it('is false when pantryId is invalid (queries skipped)', () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: '' }),
        { wrapper: createApolloWrapper([]) },
      );

      expect(result.current.loading).toBe(false);
    });
  });

  describe('error state', () => {
    it('exposes usage query error', async () => {
      const filter = { dateRange: DateRange.LastMonth, topItemsLimit: 10 };
      const mocks: MockedResponse[] = [
        {
          request: {
            query: GetPantryUsageAnalyticsDocument,
            variables: { pantryId: 'pantry-1', filter },
          },
          error: new Error('Query failed'),
        },
        {
          request: {
            query: GetPantryWasteAnalyticsDocument,
            variables: { pantryId: 'pantry-1', filter },
          },
          result: {
            data: {
              pantry: {
                __typename: 'Pantry',
                id: 'pantry-1',
                wasteAnalytics: wasteData,
              },
            },
          },
        },
        {
          request: {
            query: GetPantryLedgerAnalyticsDocument,
            variables: {
              pantryId: 'pantry-1',
              filter,
              granularity: PeriodGranularity.Weekly,
            },
          },
          result: {
            data: {
              pantry: {
                __typename: 'Pantry',
                id: 'pantry-1',
                ledgerAnalytics: ledgerData,
              },
            },
          },
        },
      ];

      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        { wrapper: createApolloWrapper(mocks) },
      );

      await waitFor(() => expect(result.current.usageError).toBeDefined());
      expect(result.current.wasteError).toBeUndefined();
      expect(result.current.ledgerError).toBeUndefined();
    });
  });

  describe('refetch', () => {
    it('exposes a refetch function', async () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: 'pantry-1' }),
        { wrapper: createApolloWrapper(defaultMocks()) },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('skip behavior', () => {
    it('skips queries when pantryId is undefined (no mocks consumed)', () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: undefined }),
        { wrapper: createApolloWrapper([]) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.usageData).toBeNull();
    });

    it('skips queries when pantryId is whitespace-only', () => {
      const { result } = renderHook(
        () => usePantryAnalytics({ pantryId: '   ' }),
        { wrapper: createApolloWrapper([]) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.usageData).toBeNull();
    });
  });
});

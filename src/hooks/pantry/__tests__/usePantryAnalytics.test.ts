import { renderHook, act } from '@testing-library/react-native';
import { usePantryAnalytics } from '../usePantryAnalytics';

// Mock generated hooks
const mockUsageResult = {
  data: {
    pantry: {
      usageAnalytics: {
        totalItemsUsed: 42,
        topItems: [],
      },
    },
  },
  loading: false,
  error: undefined,
  refetch: jest.fn().mockResolvedValue({}),
};

const mockWasteResult = {
  data: {
    pantry: {
      wasteAnalytics: {
        totalItemsWasted: 5,
        wasteRate: 0.1,
      },
    },
  },
  loading: false,
  error: undefined,
  refetch: jest.fn().mockResolvedValue({}),
};

const mockLedgerResult = {
  data: {
    pantry: {
      ledgerAnalytics: {
        entries: [],
        summary: { totalAdded: 10, totalRemoved: 3 },
      },
    },
  },
  loading: false,
  error: undefined,
  refetch: jest.fn().mockResolvedValue({}),
};

jest.mock('#generated', () => ({
  useGetPantryUsageAnalyticsQuery: jest.fn(() => mockUsageResult),
  useGetPantryWasteAnalyticsQuery: jest.fn(() => mockWasteResult),
  useGetPantryLedgerAnalyticsQuery: jest.fn(() => mockLedgerResult),
  PeriodGranularity: { Weekly: 'WEEKLY', Monthly: 'MONTHLY', Daily: 'DAILY' },
  DateRange: { LastWeek: 'LAST_WEEK', LastMonth: 'LAST_MONTH', LastYear: 'LAST_YEAR' },
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

// Import enums after mocking
const { PeriodGranularity, DateRange } = jest.requireMock('#generated');

beforeEach(() => {
  jest.clearAllMocks();
  mockUsageResult.refetch.mockResolvedValue({});
  mockWasteResult.refetch.mockResolvedValue({});
  mockLedgerResult.refetch.mockResolvedValue({});
});

describe('usePantryAnalytics', () => {
  it('returns analytics data when pantryId is provided', () => {
    const { result } = renderHook(() =>
      usePantryAnalytics({ pantryId: 'pantry-1' }),
    );

    expect(result.current.usageData).toEqual({
      totalItemsUsed: 42,
      topItems: [],
    });
    expect(result.current.wasteData).toEqual({
      totalItemsWasted: 5,
      wasteRate: 0.1,
    });
    expect(result.current.ledgerData).toEqual({
      entries: [],
      summary: { totalAdded: 10, totalRemoved: 3 },
    });
  });

  it('returns null data when query data is undefined', () => {
    mockUsageResult.data = undefined as any;
    mockWasteResult.data = undefined as any;
    mockLedgerResult.data = undefined as any;

    const { result } = renderHook(() =>
      usePantryAnalytics({ pantryId: 'pantry-1' }),
    );

    expect(result.current.usageData).toBeNull();
    expect(result.current.wasteData).toBeNull();
    expect(result.current.ledgerData).toBeNull();
  });

  it('uses LastMonth as default dateRange', () => {
    const { result } = renderHook(() =>
      usePantryAnalytics({ pantryId: 'pantry-1' }),
    );

    expect(result.current.dateRange).toBe(DateRange.LastMonth);
  });

  it('uses Weekly as default ledgerGranularity', () => {
    const { result } = renderHook(() =>
      usePantryAnalytics({ pantryId: 'pantry-1' }),
    );

    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Weekly);
  });

  it('accepts custom initial dateRange and granularity', () => {
    const { result } = renderHook(() =>
      usePantryAnalytics({
        pantryId: 'pantry-1',
        initialDateRange: DateRange.LastYear,
        ledgerGranularity: PeriodGranularity.Monthly,
      }),
    );

    expect(result.current.dateRange).toBe(DateRange.LastYear);
    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Monthly);
  });

  it('allows changing dateRange via setDateRange', () => {
    const { result } = renderHook(() =>
      usePantryAnalytics({ pantryId: 'pantry-1' }),
    );

    act(() => {
      result.current.setDateRange(DateRange.LastWeek);
    });

    expect(result.current.dateRange).toBe(DateRange.LastWeek);
  });

  it('allows changing ledgerGranularity via setLedgerGranularity', () => {
    const { result } = renderHook(() =>
      usePantryAnalytics({ pantryId: 'pantry-1' }),
    );

    act(() => {
      result.current.setLedgerGranularity(PeriodGranularity.Daily);
    });

    expect(result.current.ledgerGranularity).toBe(PeriodGranularity.Daily);
  });

  describe('loading state', () => {
    it('aggregates loading from all three queries', () => {
      mockUsageResult.loading = true;
      mockWasteResult.loading = false;
      mockLedgerResult.loading = false;

      const { result } = renderHook(() =>
        usePantryAnalytics({ pantryId: 'pantry-1' }),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.usageLoading).toBe(true);
      expect(result.current.wasteLoading).toBe(false);
    });

    it('is false when all queries are done', () => {
      mockUsageResult.loading = false;
      mockWasteResult.loading = false;
      mockLedgerResult.loading = false;

      const { result } = renderHook(() =>
        usePantryAnalytics({ pantryId: 'pantry-1' }),
      );

      expect(result.current.loading).toBe(false);
    });
  });

  describe('error state', () => {
    it('exposes individual query errors', () => {
      const testError = new Error('Query failed');
      mockUsageResult.error = testError as any;

      const { result } = renderHook(() =>
        usePantryAnalytics({ pantryId: 'pantry-1' }),
      );

      expect(result.current.usageError).toBe(testError);
      expect(result.current.wasteError).toBeUndefined();
      expect(result.current.ledgerError).toBeUndefined();
    });
  });

  describe('refetch', () => {
    it('calls refetch on all three queries', async () => {
      const { result } = renderHook(() =>
        usePantryAnalytics({ pantryId: 'pantry-1' }),
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockUsageResult.refetch).toHaveBeenCalledTimes(1);
      expect(mockWasteResult.refetch).toHaveBeenCalledTimes(1);
      expect(mockLedgerResult.refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('skip behavior', () => {
    it('passes skip when pantryId is undefined', () => {
      const { useGetPantryUsageAnalyticsQuery } = jest.requireMock('#generated');

      renderHook(() => usePantryAnalytics({ pantryId: undefined }));

      expect(useGetPantryUsageAnalyticsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('passes skip when pantryId is empty string', () => {
      const { useGetPantryUsageAnalyticsQuery } = jest.requireMock('#generated');

      renderHook(() => usePantryAnalytics({ pantryId: '' }));

      expect(useGetPantryUsageAnalyticsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('passes skip when pantryId is whitespace-only', () => {
      const { useGetPantryUsageAnalyticsQuery } = jest.requireMock('#generated');

      renderHook(() => usePantryAnalytics({ pantryId: '   ' }));

      expect(useGetPantryUsageAnalyticsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('does not skip when pantryId is valid', () => {
      const { useGetPantryUsageAnalyticsQuery } = jest.requireMock('#generated');

      renderHook(() => usePantryAnalytics({ pantryId: 'pantry-1' }));

      expect(useGetPantryUsageAnalyticsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      );
    });
  });
});

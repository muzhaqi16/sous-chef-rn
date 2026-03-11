'use no memo';
import { renderHook } from '@testing-library/react-native';
import { useMealPlans } from '../useMealPlans';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockUseGetMealPlansQuery = jest.fn();
jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetMealPlansQuery: (...args: any[]) => mockUseGetMealPlansQuery(...args),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({ isLoggedOut: false }),
}));
jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

describe('useMealPlans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty mealPlans when no data', () => {
    mockUseGetMealPlansQuery.mockReturnValue({
      data: null,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
      fetchMore: jest.fn(),
    });
    const { result } = renderHook(() => useMealPlans());
    expect(result.current.mealPlans).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('returns mealPlans from query data', () => {
    const now = new Date();
    const plan = { id: '1', startDate: now.toISOString(), endDate: now.toISOString() };
    mockUseGetMealPlansQuery.mockReturnValue({
      data: {
        mealPlans: {
          edges: [{ node: plan }],
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
      fetchMore: jest.fn(),
    });
    const { result } = renderHook(() => useMealPlans());
    expect(result.current.mealPlans).toEqual([plan]);
    expect(result.current.totalCount).toBe(1);
  });

  it('identifies active plan as current', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);
    const activePlan = { id: 'active', startDate: yesterday.toISOString(), endDate: tomorrow.toISOString() };
    mockUseGetMealPlansQuery.mockReturnValue({
      data: {
        mealPlans: {
          edges: [{ node: activePlan }],
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
      fetchMore: jest.fn(),
    });
    const { result } = renderHook(() => useMealPlans());
    expect(result.current.currentPlan?.id).toBe('active');
  });
});

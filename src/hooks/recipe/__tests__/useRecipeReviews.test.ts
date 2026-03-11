import { renderHook, act } from '@testing-library/react-native';
import { useRecipeReviews } from '../useRecipeReviews';

const mockCreateReview = jest.fn();
const mockUpdateReview = jest.fn();
const mockDeleteReview = jest.fn();
const mockToggleHelpful = jest.fn();

const mockUseGetRecipeReviewsQuery = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useCreateRecipeReviewMutation: jest.fn(() => [mockCreateReview, { loading: false }]),
  useUpdateRecipeReviewMutation: jest.fn(() => [mockUpdateReview, { loading: false }]),
  useDeleteRecipeReviewMutation: jest.fn(() => [mockDeleteReview, { loading: false }]),
  useToggleReviewHelpfulMutation: jest.fn(() => [mockToggleHelpful, { loading: false }]),
  useGetRecipeReviewsQuery: (...args: any[]) => mockUseGetRecipeReviewsQuery(...args),
}));

jest.mock('#hooks/auth/useAuthUser', () => ({
  useAuthUser: jest.fn(() => ({ id: 'user-1' })),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Break circular dependency
jest.mock('../../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
  mockUseGetRecipeReviewsQuery.mockReturnValue({ data: reviewsQueryData });
});

const reviewsQueryData = {
  recipe: {
    id: 'recipe-1',
    reviews: {
      edges: [
        {
          node: {
            id: 'rev-1',
            rating: 5,
            comment: 'Great!',
            helpful: 3,
            createdAt: '2025-01-01T00:00:00Z',
            user: { id: 'user-2' },
            helpfulVotes: [{ user: { id: 'user-1' } }],
          },
        },
        {
          node: {
            id: 'rev-2',
            rating: 4,
            comment: 'Good',
            helpful: 1,
            createdAt: '2025-01-02T00:00:00Z',
            user: { id: 'user-1' },
            helpfulVotes: [],
          },
        },
      ],
      totalCount: 2,
    },
  },
};

const makeBackendRecipe = (overrides?: any) => ({
  totalReviews: 3,
  averageRating: 4.2,
  rating1Count: 0,
  rating2Count: 0,
  rating3Count: 1,
  rating4Count: 1,
  rating5Count: 1,
  createdBy: { id: 'other-user' },
  ...overrides,
});

describe('useRecipeReviews', () => {
  it('computes derived review data', () => {
    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    expect(result.current.state.totalReviews).toBe(3);
    expect(result.current.state.averageRating).toBe(4.2);
    expect(result.current.state.rating5Count).toBe(1);
  });

  it('sorts reviews by helpful count desc, then by date desc', () => {
    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    // rev-1 has helpful=3, rev-2 has helpful=1
    expect(result.current.state.reviews[0].id).toBe('rev-1');
    expect(result.current.state.reviews[1].id).toBe('rev-2');
  });

  it('identifies current user review', () => {
    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    expect(result.current.state.userReview?.id).toBe('rev-2');
    expect(result.current.state.hasReviewed).toBe(true);
  });

  it('identifies if user is recipe owner', () => {
    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe({ createdBy: { id: 'user-1' } }) as any,
      }),
    );

    expect(result.current.state.isOwnRecipe).toBe(true);
  });

  it('isOwnRecipe is false for non-owner', () => {
    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    expect(result.current.state.isOwnRecipe).toBe(false);
  });

  it('hasVotedHelpful returns true when user voted on a review', () => {
    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    // rev-1 has helpfulVotes containing user-1
    expect(result.current.actions.hasVotedHelpful(result.current.state.reviews[0])).toBe(true);
    // rev-2 has no helpful votes
    expect(result.current.actions.hasVotedHelpful(result.current.state.reviews[1])).toBe(false);
  });

  it('createReview calls mutation and shows toast', async () => {
    mockCreateReview.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    await act(async () => {
      await result.current.actions.createReview(5, 'Amazing!');
    });

    expect(mockCreateReview).toHaveBeenCalledWith({
      variables: {
        input: { recipeId: 'recipe-1', rating: 5, comment: 'Amazing!' },
      },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Review submitted');
  });

  it('deleteReview calls mutation and shows toast', async () => {
    mockDeleteReview.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() =>
      useRecipeReviews({
        recipeId: 'recipe-1',
        backendRecipe: makeBackendRecipe() as any,
      }),
    );

    await act(async () => {
      await result.current.actions.deleteReview('rev-2');
    });

    expect(mockDeleteReview).toHaveBeenCalledWith({ variables: { id: 'rev-2' } });
    expect(mockToastSuccess).toHaveBeenCalledWith('Review deleted');
  });

  it('returns defaults when backendRecipe is null', () => {
    mockUseGetRecipeReviewsQuery.mockReturnValue({ data: undefined });
    const { result } = renderHook(() =>
      useRecipeReviews({ recipeId: 'recipe-1', backendRecipe: null }),
    );

    expect(result.current.state.totalReviews).toBe(0);
    expect(result.current.state.averageRating).toBe(0);
    expect(result.current.state.reviews).toEqual([]);
    expect(result.current.state.userReview).toBeNull();
    expect(result.current.state.hasReviewed).toBe(false);
    expect(result.current.state.isOwnRecipe).toBe(false);
  });
});

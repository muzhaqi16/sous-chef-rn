import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetRecipeReviewsDocument } from '#features/recipes/graphql/recipe.generated';
import {
  CreateRecipeReviewDocument,
  DeleteRecipeReviewDocument,
} from '#features/recipes/graphql/recipeReview.generated';
import { useRecipeReviews } from '../useRecipeReviews';
import type { MaterializedRecipe } from '../useRecipeData';
import type { toastService } from '#/services/toastService';

jest.mock('#store/useAppStore', () => ({
  useUser: jest.fn(() => ({ id: 'user-1' })),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: Parameters<typeof toastService.success>) =>
      mockToastSuccess(...args),
    error: (...args: Parameters<typeof toastService.error>) =>
      mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

function buildReviewNode(
  id: string,
  rating: number,
  helpful: number,
  createdAt: string,
  user: { id: string },
  votedByUserIds: string[] = [],
) {
  return {
    __typename: 'RecipeReview',
    id,
    rating,
    comment: id === 'rev-1' ? 'Great!' : 'Good',
    helpful,
    verified: false,
    createdAt,
    updatedAt: createdAt,
    user: {
      __typename: 'User',
      id: user.id,
      email: `${user.id}@test.com`,
      profile: {
        __typename: 'UserProfile',
        id: `${user.id}-profile`,
        displayName: user.id,
        avatar: null,
      },
    },
    helpfulVotes: votedByUserIds.map(uid => ({
      __typename: 'ReviewHelpful',
      id: `vote-${uid}-${id}`,
      user: { __typename: 'User', id: uid },
    })),
  };
}

function buildGetRecipeReviewsMock(
  recipeId: string = 'recipe-1',
  reviewNodes?: Array<ReturnType<typeof buildReviewNode>>,
): MockedResponse {
  const nodes = reviewNodes ?? [
    buildReviewNode('rev-1', 5, 3, '2025-01-01T00:00:00Z', { id: 'user-2' }, [
      'user-1',
    ]),
    buildReviewNode('rev-2', 4, 1, '2025-01-02T00:00:00Z', { id: 'user-1' }),
  ];

  return {
    request: {
      query: GetRecipeReviewsDocument,
      variables: { id: recipeId },
    },
    result: {
      data: {
        recipe: {
          __typename: 'Recipe',
          id: recipeId,
          reviews: {
            __typename: 'RecipeReviewConnection',
            totalCount: nodes.length,
            edges: nodes.map(node => ({
              __typename: 'RecipeReviewEdge',
              node,
            })),
          },
        },
      },
    },
  };
}

function buildEmptyRecipeReviewsMock(
  recipeId: string = 'recipe-1',
): MockedResponse {
  return {
    request: {
      query: GetRecipeReviewsDocument,
      variables: { id: recipeId },
    },
    result: {
      data: {
        recipe: null,
      },
    },
  };
}

function buildCreateReviewMock(): MockedResponse {
  return {
    request: {
      query: CreateRecipeReviewDocument,
      variables: () => true,
    },
    result: {
      data: {
        createRecipeReview: {
          __typename: 'CreateRecipeReviewPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          recipeReview: buildReviewNode(
            'rev-new',
            5,
            0,
            '2025-01-03T00:00:00Z',
            { id: 'user-1' },
          ),
        },
      },
    },
  };
}

function buildDeleteReviewMock(): MockedResponse {
  return {
    request: {
      query: DeleteRecipeReviewDocument,
      variables: { input: { id: 'rev-2' } },
    },
    result: {
      data: {
        deleteRecipeReview: {
          __typename: 'DeleteRecipeReviewPayload',
          recipeReview: {
            __typename: 'RecipeReview',
            id: 'rev-2',
          },
        },
      },
    },
  };
}

const makeBackendRecipe = (
  overrides?: Partial<MaterializedRecipe>,
): MaterializedRecipe => ({
  __typename: 'Recipe',
  id: 'recipe-1',
  name: 'Test Recipe',
  description: null,
  imageUrl: null,
  servings: 1,
  totalTimeMinutes: null,
  source: null,
  sourceUrl: null,
  instructions: null,
  savedDetails: null,
  ingredients: [],
  totalReviews: 3,
  averageRating: 4.2,
  rating1Count: 0,
  rating2Count: 0,
  rating3Count: 1,
  rating4Count: 1,
  rating5Count: 1,
  createdBy: { __typename: 'User', id: 'other-user', email: 'other@test.com' },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRecipeReviews', () => {
  it('computes derived review data', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      { operationMocks: [buildGetRecipeReviewsMock()] },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    expect(result.current.state.totalReviews).toBe(3);
    expect(result.current.state.averageRating).toBe(4.2);
    expect(result.current.state.rating5Count).toBe(1);
  });

  it('sorts reviews by helpful count desc, then by date desc', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      { operationMocks: [buildGetRecipeReviewsMock()] },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    // rev-1 has helpful=3, rev-2 has helpful=1
    expect(result.current.state.reviews[0].id).toBe('rev-1');
    expect(result.current.state.reviews[1].id).toBe('rev-2');
  });

  it('identifies current user review', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      { operationMocks: [buildGetRecipeReviewsMock()] },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    expect(result.current.state.userReview?.id).toBe('rev-2');
    expect(result.current.state.hasReviewed).toBe(true);
  });

  it('identifies if user is recipe owner', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe({
            createdBy: {
              __typename: 'User',
              id: 'user-1',
              email: 'user-1@test.com',
            },
          }),
        }),
      { operationMocks: [buildGetRecipeReviewsMock()] },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));
    expect(result.current.state.isOwnRecipe).toBe(true);
  });

  it('isOwnRecipe is false for non-owner', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      { operationMocks: [buildGetRecipeReviewsMock()] },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));
    expect(result.current.state.isOwnRecipe).toBe(false);
  });

  it('hasVotedHelpful returns true when user voted on a review', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      { operationMocks: [buildGetRecipeReviewsMock()] },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    // rev-1 has helpfulVotes containing user-1
    expect(
      result.current.actions.hasVotedHelpful(result.current.state.reviews[0]),
    ).toBe(true);
    // rev-2 has no helpful votes
    expect(
      result.current.actions.hasVotedHelpful(result.current.state.reviews[1]),
    ).toBe(false);
  });

  it('createReview calls mutation and shows toast', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      {
        operationMocks: [
          buildGetRecipeReviewsMock(),
          buildCreateReviewMock(),
          // refetchQueries triggers a second GetRecipeReviews fetch
          buildGetRecipeReviewsMock(),
        ],
      },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    await act(async () => {
      await result.current.actions.createReview(5, 'Amazing!');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Review submitted');
  });

  it('deleteReview calls mutation and shows toast', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      {
        operationMocks: [
          buildGetRecipeReviewsMock(),
          buildDeleteReviewMock(),
          buildGetRecipeReviewsMock(),
        ],
      },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    await act(async () => {
      await result.current.actions.deleteReview('rev-2');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Review deleted');
  });

  it('returns defaults when backendRecipe is null', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeReviews({ recipeId: 'recipe-1', backendRecipe: null }),
      { operationMocks: [buildEmptyRecipeReviewsMock()] },
    );

    // For a null recipe response, reviews stays empty
    await waitFor(() => expect(result.current.state.reviews).toEqual([]));

    expect(result.current.state.totalReviews).toBe(0);
    expect(result.current.state.averageRating).toBe(0);
    expect(result.current.state.userReview).toBeNull();
    expect(result.current.state.hasReviewed).toBe(false);
    expect(result.current.state.isOwnRecipe).toBe(false);
  });
});

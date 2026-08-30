import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { GetRecipeReviewsDocument } from '#features/recipes/graphql/recipe.generated';
import {
  CreateRecipeReviewDocument,
  DeleteRecipeReviewDocument,
  ToggleReviewHelpfulDocument,
} from '#features/recipes/graphql/recipeReview.generated';
import { useRecipeReviews } from '../useRecipeReviews';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
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
  // Server-computed for the requesting user, so it's a flag rather than a
  // voter list — the API windows `helpfulVotes` and so cannot answer
  // "did I vote".
  viewerHasVotedHelpful: boolean = false,
) {
  return {
    __typename: 'RecipeReview' as const,
    id,
    rating,
    comment: id === 'rev-1' ? 'Great!' : 'Good',
    helpful,
    verified: false,
    createdAt,
    updatedAt: createdAt,
    user: {
      __typename: 'User' as const,
      id: user.id,
      email: `${user.id}@test.com`,
      profile: {
        __typename: 'UserProfile' as const,
        id: `${user.id}-profile`,
        displayName: user.id,
        avatar: null,
      },
    },
    viewerHasVotedHelpful,
  };
}

function buildGetRecipeReviewsMock(
  recipeId: string = 'recipe-1',
  reviewNodes?: Array<ReturnType<typeof buildReviewNode>>,
): MockedResponse {
  const nodes = reviewNodes ?? [
    // rev-1 is someone else's review that the viewer has marked helpful;
    // rev-2 is the viewer's own, unvoted.
    buildReviewNode(
      'rev-1',
      5,
      3,
      '2025-01-01T00:00:00Z',
      { id: 'user-2' },
      true,
    ),
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
          __typename: 'Recipe' as const,
          id: recipeId,
          reviews: {
            __typename: 'RecipeReviewConnection' as const,
            totalCount: nodes.length,
            edges: nodes.map(node => ({
              __typename: 'RecipeReviewEdge' as const,
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
          // `CreateRecipeReviewPayload` has two fields — `recipe` and
          // `recipeReview`. `code`/`message` are selected on the ERROR members
          // of the union, and `success` is on none of them.
          __typename: 'CreateRecipeReviewPayload' as const,
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
          __typename: 'DeleteRecipeReviewPayload' as const,
          recipeReview: {
            __typename: 'RecipeReview' as const,
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
  __typename: 'Recipe' as const,
  id: 'recipe-1',
  name: 'Test Recipe',
  description: null,
  imageUrl: null,
  servings: 1,
  totalTimeMinutes: null,
  caloriesPerServing: null,
  nutritionData: null,
  status: RecipeStatus.Draft,
  isPublished: false,
  publishedAt: null,
  forkedFromId: null,
  forkedFrom: null,
  originalAuthor: null,
  tips: null,
  videoUrl: null,
  tags: [],
  source: null,
  sourceUrl: null,
  instructions: null,
  savedDetails: null,
  ingredientsConnection: {
    __typename: 'RecipeIngredientConnection' as const,
    edges: [],
  },
  totalReviews: 3,
  averageRating: 4.2,
  rating1Count: 0,
  rating2Count: 0,
  rating3Count: 1,
  rating4Count: 1,
  rating5Count: 1,
  createdBy: {
    __typename: 'User' as const,
    id: 'other-user',
    email: 'other@test.com',
  },
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
              __typename: 'User' as const,
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

    // rev-1 comes back with viewerHasVotedHelpful: true …
    expect(
      result.current.actions.hasVotedHelpful(result.current.state.reviews[0]),
    ).toBe(true);
    // … rev-2 with false.
    expect(
      result.current.actions.hasVotedHelpful(result.current.state.reviews[1]),
    ).toBe(false);
  });

  it('toggleHelpful flips the button state and the count in the cache', async () => {
    // The `update` callback is the only thing that moves the button before the
    // response lands. It bumped `helpful` but left the vote flag alone, so the
    // button stayed un-voted and the next tap re-sent isHelpful: true.
    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      {
        operationMocks: [
          buildGetRecipeReviewsMock(),
          {
            request: {
              query: ToggleReviewHelpfulDocument,
              variables: { input: { reviewId: 'rev-2', isHelpful: true } },
            },
            result: {
              data: {
                toggleReviewHelpful: {
                  __typename: 'ToggleReviewHelpfulPayload' as const,
                  reviewHelpful: {
                    __typename: 'ReviewHelpful' as const,
                    id: 'vote-1',
                    user: { __typename: 'User' as const, id: 'user-1' },
                  },
                },
              },
            },
          },
        ],
      },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));
    const target = result.current.state.reviews.find(r => r.id === 'rev-2')!;
    expect(result.current.actions.hasVotedHelpful(target)).toBe(false);

    await act(async () => {
      await result.current.actions.toggleHelpful('rev-2', true);
    });

    await waitFor(() => {
      const updated = result.current.state.reviews.find(r => r.id === 'rev-2')!;
      expect(result.current.actions.hasVotedHelpful(updated)).toBe(true);
      expect(updated.helpful).toBe(2);
    });
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

  it('createReview mints a client id so a lost-response retry converges', async () => {
    const { mock, fired } = recordMock(CreateRecipeReviewDocument, {
      data: {
        createRecipeReview: {
          __typename: 'CreateRecipeReviewPayload' as const,
          recipeReview: buildReviewNode(
            'rev-new',
            5,
            0,
            '2025-01-03T00:00:00Z',
            { id: 'user-1' },
          ),
        },
      },
    });

    const { result } = renderHookWithApollo(
      () =>
        useRecipeReviews({
          recipeId: 'recipe-1',
          backendRecipe: makeBackendRecipe(),
        }),
      {
        operationMocks: [
          buildGetRecipeReviewsMock(),
          mock,
          buildGetRecipeReviewsMock(),
        ],
      },
    );

    await waitFor(() => expect(result.current.state.reviews).toHaveLength(2));

    await act(async () => {
      await result.current.actions.createReview(4, 'Solid');
    });

    // Without a client-minted id, a retried create collapses into an
    // indistinguishable "already reviewed" CONFLICT (offline-sync contract).
    expect(fired).toHaveLength(1);
    const input = (fired[0] as { input: { id?: string } }).input;
    expect(typeof input.id).toBe('string');
    expect(input.id!.length).toBeGreaterThan(0);
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

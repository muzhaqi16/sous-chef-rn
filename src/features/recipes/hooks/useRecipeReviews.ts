import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  CreateRecipeReviewDocument,
  UpdateRecipeReviewDocument,
  DeleteRecipeReviewDocument,
  ToggleReviewHelpfulDocument,
} from '#features/recipes/graphql/recipeReview.generated';
import { GetRecipeReviewsDocument } from '#features/recipes/graphql/recipe.generated';
import {
  RecipeReviewFragmentDoc,
  type RecipeReviewFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import { type MaterializedRecipe } from './useRecipeData';
import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import {
  addReviewToRecipe,
  changeReviewRating,
  getReviewRating,
  removeReviewFromRecipe,
} from '#/apollo/utils/recipeReviewCacheUpdaters';

interface UseRecipeReviewsOptions {
  recipeId: string;
  backendRecipe: MaterializedRecipe | null | undefined;
}

/**
 * Manages recipe reviews — fetching, creating, updating, deleting, and helpfulness voting.
 *
 * @param options.recipeId - The recipe ID to fetch/manage reviews for
 * @param options.backendRecipe - The recipe fragment for ownership checks
 * @returns `{ state, actions }` — review data/stats in state, mutation functions in actions
 */
export function useRecipeReviews({
  recipeId,
  backendRecipe,
}: UseRecipeReviewsOptions) {
  const user = useUser();
  const userId = user?.id;
  const apolloClient = useApolloClient();

  // Fetch reviews separately to avoid exceeding query depth limit
  const { data: reviewsData } = useQuery(GetRecipeReviewsDocument, {
    variables: { id: recipeId },
    skip: !recipeId,
  });

  // Derived data from recipe
  const totalReviews = backendRecipe?.totalReviews ?? 0;
  const averageRating = backendRecipe?.averageRating ?? 0;
  const rating1Count = backendRecipe?.rating1Count ?? 0;
  const rating2Count = backendRecipe?.rating2Count ?? 0;
  const rating3Count = backendRecipe?.rating3Count ?? 0;
  const rating4Count = backendRecipe?.rating4Count ?? 0;
  const rating5Count = backendRecipe?.rating5Count ?? 0;

  // Materialize each masked review ref via cache.readFragment so we can
  // sort/filter by `helpful`, `createdAt`, and inspect `user`.
  const reviews = (() => {
    const rawRefs =
      reviewsData?.recipe?.reviews?.edges?.map(edge => edge.node) ?? [];
    const materialized = rawRefs
      .map(ref =>
        apolloClient.cache.readFragment<RecipeReviewFragment>({
          fragment: RecipeReviewFragmentDoc,
          fragmentName: 'RecipeReviewFragment',
          from: { __typename: 'RecipeReview', id: ref.id },
        }),
      )
      .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined);
    return materialized.sort((a, b) => {
      if (b.helpful !== a.helpful) return b.helpful - a.helpful;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  // Current user's review
  const userReview = userId
    ? reviews.find(r => r.user.id === userId) ?? null
    : null;

  const hasReviewed = !!userReview;
  const isOwnRecipe = backendRecipe?.createdBy?.id === userId;

  // Mutations
  const [createReviewMutation, { loading: createLoading }] = useMutation(
    CreateRecipeReviewDocument,
    {
      update: (cache, { data }) => {
        const payload = data?.createRecipeReview;
        if (payload?.__typename === 'CreateRecipeReviewPayload') {
          const review = payload.recipeReview;
          addReviewToRecipe(cache, recipeId, {
            id: review.id,
            rating: review.rating,
          });
        }
      },
      onError: err => {
        toastService.error(err.message || 'Failed to submit review');
      },
    },
  );

  const [updateReviewMutation, { loading: updateLoading }] = useMutation(
    UpdateRecipeReviewDocument,
    {
      onError: err => {
        toastService.error(err.message || 'Failed to update review');
      },
    },
  );

  const [deleteReviewMutation, { loading: deleteLoading }] = useMutation(
    DeleteRecipeReviewDocument,
    {
      update: (cache, { data }, { variables }) => {
        if (
          data?.deleteRecipeReview?.__typename !==
            'DeleteRecipeReviewPayload' ||
          !variables?.input?.id
        ) {
          return;
        }
        removeReviewFromRecipe(cache, recipeId, variables.input.id);
      },
      onError: err => {
        toastService.error(err.message || 'Failed to delete review');
      },
    },
  );

  const [toggleHelpfulMutation] = useMutation(ToggleReviewHelpfulDocument, {
    update: (cache, { data }, { variables }) => {
      if (
        data?.toggleReviewHelpful?.__typename !==
          'ToggleReviewHelpfulPayload' ||
        !variables?.input
      ) {
        return;
      }
      const { reviewId, isHelpful } = variables.input;
      cache.modify({
        id: cache.identify({ __typename: 'RecipeReview', id: reviewId }),
        fields: {
          helpful(existing: number = 0) {
            const current = existing ?? 0;
            return isHelpful ? current + 1 : Math.max(0, current - 1);
          },
        },
      });
    },
    onError: err => {
      toastService.error(err.message || 'Failed to update helpful vote');
    },
  });

  const submitting = createLoading || updateLoading || deleteLoading;

  // Actions
  const createReview = async (rating: number, comment?: string) => {
    const result = await createReviewMutation({
      variables: {
        input: { recipeId, rating, comment: comment || undefined },
      },
    });
    const payload = result.data?.createRecipeReview;
    if (payload?.__typename === 'RateLimitError') {
      toastService.error(payload.message);
      return;
    }
    toastService.success('Review submitted');
  };

  const updateReview = async (
    id: string,
    input: { rating?: number; comment?: string },
  ) => {
    const prevRating = getReviewRating(apolloClient.cache, id);
    await updateReviewMutation({
      variables: {
        input: {
          id,
          rating: input.rating,
          comment: input.comment,
        },
      },
      update: (cache, { data }) => {
        const payload = data?.updateRecipeReview;
        if (payload?.__typename !== 'UpdateRecipeReviewPayload') return;
        const review = payload.recipeReview;
        if (prevRating === null) return;
        if (prevRating !== review.rating) {
          changeReviewRating(cache, recipeId, prevRating, review.rating);
        }
      },
    });
    toastService.success('Review updated');
  };

  const deleteReview = async (id: string) => {
    await deleteReviewMutation({ variables: { input: { id } } });
    toastService.success('Review deleted');
  };

  const toggleHelpful = async (reviewId: string, isHelpful: boolean) => {
    await toggleHelpfulMutation({
      variables: { input: { reviewId, isHelpful } },
    });
  };

  // Check if user has voted helpful on a review
  const hasVotedHelpful = (review: RecipeReviewFragment) => {
    if (!userId) return false;
    return review.helpfulVotes.some(v => v.user.id === userId);
  };

  return {
    state: {
      reviews,
      totalReviews,
      averageRating,
      rating1Count,
      rating2Count,
      rating3Count,
      rating4Count,
      rating5Count,
      userReview,
      hasReviewed,
      isOwnRecipe,
      submitting,
    },
    actions: {
      createReview,
      updateReview,
      deleteReview,
      toggleHelpful,
      hasVotedHelpful,
    },
  };
}

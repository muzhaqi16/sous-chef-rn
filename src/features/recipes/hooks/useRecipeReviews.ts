import { useMutation, useQuery } from '@apollo/client/react';
import {
  CreateRecipeReviewDocument,
  UpdateRecipeReviewDocument,
  DeleteRecipeReviewDocument,
  ToggleReviewHelpfulDocument,
} from '#features/recipes/graphql/recipeReview.generated';
import {
  GetRecipeReviewsDocument,
  GetRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  type RecipeFragment,
  type RecipeReviewFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';

interface UseRecipeReviewsOptions {
  recipeId: string;
  backendRecipe: RecipeFragment | null | undefined;
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

  // Sort reviews: most helpful first, then newest
  const reviews = (() => {
    const raw =
      reviewsData?.recipe?.reviews?.edges?.map(edge => edge.node) ?? [];
    return [...raw].sort((a, b) => {
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

  // Refetch both queries: reviews list + recipe metadata (counts, average)
  const refetchQueries = [
    { query: GetRecipeReviewsDocument, variables: { id: recipeId } },
    { query: GetRecipeDocument, variables: { id: recipeId } },
  ];

  // Mutations
  const [createReviewMutation, { loading: createLoading }] = useMutation(
    CreateRecipeReviewDocument,
    {
      refetchQueries: refetchQueries,
      onError: err => {
        toastService.error(err.message || 'Failed to submit review');
      },
    },
  );

  const [updateReviewMutation, { loading: updateLoading }] = useMutation(
    UpdateRecipeReviewDocument,
    {
      refetchQueries: refetchQueries,
      onError: err => {
        toastService.error(err.message || 'Failed to update review');
      },
    },
  );

  const [deleteReviewMutation, { loading: deleteLoading }] = useMutation(
    DeleteRecipeReviewDocument,
    {
      refetchQueries: refetchQueries,
      update: (cache, { data }, { variables }) => {
        if (!data?.deleteRecipeReview?.success || !variables?.id) return;
        safeEvict(cache, 'RecipeReview', variables.id);
      },
      onError: err => {
        toastService.error(err.message || 'Failed to delete review');
      },
    },
  );

  const [toggleHelpfulMutation] = useMutation(ToggleReviewHelpfulDocument, {
    update: (cache, { data }, { variables }) => {
      if (!data?.toggleReviewHelpful?.success || !variables?.input) return;
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
    await createReviewMutation({
      variables: {
        input: { recipeId, rating, comment: comment || undefined },
      },
    });
    toastService.success('Review submitted');
  };

  const updateReview = async (
    id: string,
    input: { rating?: number; comment?: string },
  ) => {
    await updateReviewMutation({
      variables: {
        id,
        input: {
          rating: input.rating,
          comment: input.comment,
        },
      },
    });
    toastService.success('Review updated');
  };

  const deleteReview = async (id: string) => {
    await deleteReviewMutation({ variables: { id } });
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

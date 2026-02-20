import { useMemo, useCallback } from 'react';
import {
  useCreateRecipeReviewMutation,
  useUpdateRecipeReviewMutation,
  useDeleteRecipeReviewMutation,
  useToggleReviewHelpfulMutation,
  GetRecipeDocument,
  type RecipeFragment,
  type RecipeReviewFragment,
} from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { toastService } from '#/services/toastService';

interface UseRecipeReviewsOptions {
  recipeId: string;
  backendRecipe: RecipeFragment | null | undefined;
}

export function useRecipeReviews({ recipeId, backendRecipe }: UseRecipeReviewsOptions) {
  const { user } = useAuth();
  const userId = user?.id;

  // Derived data from recipe
  const totalReviews = backendRecipe?.totalReviews ?? 0;
  const averageRating = backendRecipe?.averageRating ?? 0;
  const rating1Count = backendRecipe?.rating1Count ?? 0;
  const rating2Count = backendRecipe?.rating2Count ?? 0;
  const rating3Count = backendRecipe?.rating3Count ?? 0;
  const rating4Count = backendRecipe?.rating4Count ?? 0;
  const rating5Count = backendRecipe?.rating5Count ?? 0;

  // Sort reviews: most helpful first, then newest
  const reviews = useMemo(() => {
    const raw = backendRecipe?.reviews?.edges?.map(edge => edge.node) ?? [];
    return [...raw].sort((a, b) => {
      if (b.helpful !== a.helpful) return b.helpful - a.helpful;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [backendRecipe?.reviews]);

  // Current user's review
  const userReview = useMemo(
    () => (userId ? reviews.find(r => r.user.id === userId) ?? null : null),
    [reviews, userId],
  );

  const hasReviewed = !!userReview;
  const isOwnRecipe = backendRecipe?.createdBy?.id === userId;

  // Refetch recipe query to refresh all review-related fields (reviews, counts, average)
  const refetchRecipe = {
    query: GetRecipeDocument,
    variables: { id: recipeId },
  };

  // Mutations
  const [createReviewMutation, { loading: createLoading }] =
    useCreateRecipeReviewMutation({
      refetchQueries: [refetchRecipe],
      onError: err => {
        toastService.error(err.message || 'Failed to submit review');
      },
    });

  const [updateReviewMutation, { loading: updateLoading }] =
    useUpdateRecipeReviewMutation({
      refetchQueries: [refetchRecipe],
      onError: err => {
        toastService.error(err.message || 'Failed to update review');
      },
    });

  const [deleteReviewMutation, { loading: deleteLoading }] =
    useDeleteRecipeReviewMutation({
      refetchQueries: [refetchRecipe],
      update: (cache, { data }, { variables }) => {
        if (!data?.deleteRecipeReview?.success || !variables?.id) return;
        cache.evict({ id: cache.identify({ __typename: 'RecipeReview', id: variables.id }) });
        cache.gc();
      },
      onError: err => {
        toastService.error(err.message || 'Failed to delete review');
      },
    });

  const [toggleHelpfulMutation] = useToggleReviewHelpfulMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.toggleReviewHelpful?.success || !variables?.input) return;
      const { reviewId, isHelpful } = variables.input;
      cache.modify({
        id: cache.identify({ __typename: 'RecipeReview', id: reviewId }),
        fields: {
          helpful(existing: number) {
            return isHelpful ? existing + 1 : Math.max(0, existing - 1);
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
  const createReview = useCallback(
    async (rating: number, comment?: string) => {
      await createReviewMutation({
        variables: {
          input: { recipeId, rating, comment: comment || undefined },
        },
      });
      toastService.success('Review submitted');
    },
    [recipeId, createReviewMutation],
  );

  const updateReview = useCallback(
    async (id: string, input: { rating?: number; comment?: string }) => {
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
    },
    [updateReviewMutation],
  );

  const deleteReview = useCallback(
    async (id: string) => {
      await deleteReviewMutation({ variables: { id } });
      toastService.success('Review deleted');
    },
    [deleteReviewMutation],
  );

  const toggleHelpful = useCallback(
    async (reviewId: string, isHelpful: boolean) => {
      await toggleHelpfulMutation({
        variables: { input: { reviewId, isHelpful } },
      });
    },
    [toggleHelpfulMutation],
  );

  // Check if user has voted helpful on a review
  const hasVotedHelpful = useCallback(
    (review: RecipeReviewFragment) => {
      if (!userId) return false;
      return review.helpfulVotes.some(v => v.user.id === userId);
    },
    [userId],
  );

  return {
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
    createReview,
    updateReview,
    deleteReview,
    toggleHelpful,
    hasVotedHelpful,
    submitting,
  };
}

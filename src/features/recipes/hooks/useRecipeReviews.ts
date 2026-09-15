import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { generateEntityId } from '#/utils/generateEntityId';
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
import type { MaterializedRecipe } from './useRecipeData';
import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  addReviewToRecipe,
  changeReviewRating,
  getReviewRating,
  removeReviewFromRecipe,
} from '#features/recipes/cache/reviews';

interface UseRecipeReviewsOptions {
  recipeId: string;
  backendRecipe: MaterializedRecipe | null | undefined;
}

/** Recipe reviews: fetch, create, update, delete, and helpfulness voting. */
export function useRecipeReviews({
  recipeId,
  backendRecipe,
}: UseRecipeReviewsOptions) {
  const { t } = useTranslation();
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
      .filter((r): r is NonNullable<typeof r> => r != null);
    return materialized.sort((a, b) => {
      if (b.helpful !== a.helpful) return b.helpful - a.helpful;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  // Current user's review. `r.user` is null for reviews whose author deleted
  // their account, which can never be the signed-in viewer.
  const userReview = userId
    ? reviews.find(r => r.user?.id === userId) ?? null
    : null;

  const hasReviewed = !!userReview;
  const isOwnRecipe = backendRecipe?.createdBy?.id === userId;

  // Mutations
  const [createReviewMutation, { loading: createLoading }] = useMutation(
    CreateRecipeReviewDocument,
    {
      update: (cache, { data }) => {
        const payload = appliedPayload(data);
        if (!payload) return;
        const review = payload.recipeReview;
        addReviewToRecipe(cache, recipeId, {
          id: review.id,
          rating: review.rating,
        });
      },
    },
  );

  const [updateReviewMutation, { loading: updateLoading }] = useMutation(
    UpdateRecipeReviewDocument,
  );

  const [deleteReviewMutation, { loading: deleteLoading }] = useMutation(
    DeleteRecipeReviewDocument,
    {
      update: (cache, { data }, { variables }) => {
        if (!appliedPayload(data) || !variables?.input?.id) return;
        removeReviewFromRecipe(cache, recipeId, variables.input.id);
      },
    },
  );

  const [toggleHelpfulMutation] = useMutation(ToggleReviewHelpfulDocument, {
    update: (cache, { data }, { variables }) => {
      if (!appliedPayload(data) || !variables?.input) return;
      const { reviewId, isHelpful } = variables.input;
      // Both fields are client-derived until the next GetRecipeReviews read —
      // see the mutation's selection for why the server's own values aren't
      // taken here.
      cache.modify({
        id: cache.identify({ __typename: 'RecipeReview', id: reviewId }),
        fields: {
          helpful(existing: number = 0) {
            const current = existing ?? 0;
            return isHelpful ? current + 1 : Math.max(0, current - 1);
          },
          // Drives the button's state. Nothing updated it before, so the
          // button stayed put until the next refetch.
          viewerHasVotedHelpful() {
            return isHelpful;
          },
        },
      });
    },
  });

  const submitting = createLoading || updateLoading || deleteLoading;

  // Actions
  // Each write reports through one toast: the success copy, or the failure's
  // localized body — never the server's `message`.
  const createReview = async (rating: number, comment?: string) => {
    const settled = await settleMutation(
      () =>
        createReviewMutation({
          variables: {
            // Client-minted id: a lost-response retry replays with the same id
            // and surfaces as IDEMPOTENT_REPLAY (converged) instead of an
            // indistinguishable "already reviewed" CONFLICT.
            input: {
              id: generateEntityId(),
              recipeId,
              rating,
              comment: comment || undefined,
            },
          },
        }),
      {
        document: CreateRecipeReviewDocument,
        fallback: t('recipes.submitReviewFailed'),
        present: 'none',
      },
    );
    if (settled.failure) toastService.error(settled.failure.body);
    else toastService.success(t('recipes.reviewSubmitted'));
  };

  const updateReview = async (
    id: string,
    input: { rating?: number; comment?: string },
  ) => {
    const prevRating = getReviewRating(apolloClient.cache, id);
    const settled = await settleMutation(
      () =>
        updateReviewMutation({
          variables: {
            input: {
              id,
              rating: input.rating,
              comment: input.comment,
            },
          },
          update: (cache, { data }) => {
            const payload = appliedPayload(data);
            if (!payload || prevRating === null) return;
            if (prevRating !== payload.recipeReview.rating) {
              changeReviewRating(
                cache,
                recipeId,
                prevRating,
                payload.recipeReview.rating,
              );
            }
          },
        }),
      {
        document: UpdateRecipeReviewDocument,
        fallback: t('recipes.updateReviewFailed'),
        present: 'none',
      },
    );
    if (settled.failure) toastService.error(settled.failure.body);
    else toastService.success(t('recipes.reviewUpdated'));
  };

  const deleteReview = async (id: string) => {
    const settled = await settleMutation(
      () => deleteReviewMutation({ variables: { input: { id } } }),
      {
        document: DeleteRecipeReviewDocument,
        fallback: t('recipes.deleteReviewFailed'),
        removal: true,
        present: 'none',
      },
    );
    if (settled.failure) toastService.error(settled.failure.body);
    else toastService.success(t('recipes.reviewDeleted'));
  };

  const toggleHelpful = async (reviewId: string, isHelpful: boolean) => {
    const settled = await settleMutation(
      () =>
        toggleHelpfulMutation({
          variables: { input: { reviewId, isHelpful } },
        }),
      {
        document: ToggleReviewHelpfulDocument,
        fallback: t('recipes.helpfulVoteFailed'),
        present: 'none',
      },
    );
    if (settled.failure) toastService.error(settled.failure.body);
  };

  // Server-computed per requesting user — never derive it from
  // `review.helpfulVotes`, which is windowed, so a vote past the window reads
  // as un-voted. The `userId` guard is separate: the field is false for an
  // anonymous viewer, and a null id also means there is no vote to toggle.
  const hasVotedHelpful = (review: RecipeReviewFragment) =>
    !!userId && review.viewerHasVotedHelpful;

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

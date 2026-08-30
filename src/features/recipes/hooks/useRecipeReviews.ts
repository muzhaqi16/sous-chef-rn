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
import { type MaterializedRecipe } from './useRecipeData';
import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { localizedErrorMessage } from '#/services/errorService';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';
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
      .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined);
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
        const payload = data?.createRecipeReview;
        if (payload?.__typename === 'CreateRecipeReviewPayload') {
          const review = payload.recipeReview;
          addReviewToRecipe(cache, recipeId, {
            id: review.id,
            rating: review.rating,
          });
        }
      },
      // `err.message` is the server's English (or a transport error's
      // developer text). `localizedErrorMessage` resolves the error's CODE to
      // the app's own copy and falls back to the caller's — which has to be
      // PASSED to it: the resolver is total, so applying copy to its result is
      // unreachable, and a transport failure on a write then reports the
      // read-oriented offline sentence instead of what did not save.
      onError: err => {
        toastService.error(
          localizedErrorMessage(err, t('recipes.submitReviewFailed')),
        );
      },
    },
  );

  const [updateReviewMutation, { loading: updateLoading }] = useMutation(
    UpdateRecipeReviewDocument,
    {
      onError: err => {
        toastService.error(
          localizedErrorMessage(err, t('recipes.updateReviewFailed')),
        );
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
        toastService.error(
          localizedErrorMessage(err, t('recipes.deleteReviewFailed')),
        );
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
    onError: err => {
      toastService.error(
        localizedErrorMessage(err, t('recipes.helpfulVoteFailed')),
      );
    },
  });

  const submitting = createLoading || updateLoading || deleteLoading;

  // Actions
  const createReview = async (rating: number, comment?: string) => {
    const result = await createReviewMutation({
      variables: {
        // Client-minted id: a lost-response retry replays with the same id and
        // surfaces as IDEMPOTENT_REPLAY (converged) instead of an
        // indistinguishable "already reviewed" CONFLICT.
        input: {
          id: generateEntityId(),
          recipeId,
          rating,
          comment: comment || undefined,
        },
      },
    });
    const payload = result.data?.createRecipeReview;
    if (payload?.__typename === 'CreateRecipeReviewPayload') {
      toastService.success(t('recipes.reviewSubmitted'));
      return;
    }
    // Rate-limit now arrives as a top-level GraphQL error, not a RateLimitError
    // union variant.
    if (isRateLimitError(result.error)) {
      toastService.error(getRateLimitMessage(result.error));
      return;
    }
    const message = payload && 'message' in payload ? payload.message : null;
    toastService.error(message ?? t('recipes.submitReviewFailed'));
  };

  const updateReview = async (
    id: string,
    input: { rating?: number; comment?: string },
  ) => {
    const prevRating = getReviewRating(apolloClient.cache, id);
    const result = await updateReviewMutation({
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
    const payload = result.data?.updateRecipeReview;
    if (payload?.__typename === 'UpdateRecipeReviewPayload') {
      toastService.success(t('recipes.reviewUpdated'));
      return;
    }
    const message = payload && 'message' in payload ? payload.message : null;
    toastService.error(message ?? t('recipes.updateReviewFailed'));
  };

  const deleteReview = async (id: string) => {
    const result = await deleteReviewMutation({ variables: { input: { id } } });
    const payload = result.data?.deleteRecipeReview;
    if (payload?.__typename === 'DeleteRecipeReviewPayload') {
      toastService.success(t('recipes.reviewDeleted'));
      return;
    }
    const message = payload && 'message' in payload ? payload.message : null;
    toastService.error(message ?? t('recipes.deleteReviewFailed'));
  };

  const toggleHelpful = async (reviewId: string, isHelpful: boolean) => {
    await toggleHelpfulMutation({
      variables: { input: { reviewId, isHelpful } },
    });
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
